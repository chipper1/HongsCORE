package io.github.ihongs.dh.search;

import io.github.ihongs.Cnst;
import io.github.ihongs.Core;
import io.github.ihongs.CoreLogger;
import io.github.ihongs.HongsException;
import io.github.ihongs.HongsExemption;
import io.github.ihongs.action.FormSet;
import io.github.ihongs.dh.lucene.LuceneRecord;
import io.github.ihongs.util.Synt;
import io.github.ihongs.util.thread.Block;
import io.github.ihongs.util.thread.Block.Locker;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.Iterator;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;

import org.apache.lucene.document.Document;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.Term;
import org.apache.lucene.store.Directory;
import org.apache.lucene.store.FSDirectory;

/**
 * 搜索记录
 *
 * 增加写锁避免同时写入导致失败
 * 注意: 此类的对象无法使用事务
 *
 * @author Hongs
 */
public class SearchEntity extends LuceneRecord {

    private  SearchWriter WRITOR = null;

    public SearchEntity(Map form, String path, String name) {
        super(form , path , name);
    }

    public SearchEntity(Map form) {
        this (form , null , null);
    }

    /**
     * 获取实例
     * 存储为 conf/form 表单为 conf.form
     * 表单缺失则尝试获取 conf/form.form
     * 实例生命周期将交由 Core 维护
     * @param conf
     * @param form
     * @return
     * @throws HongsException
     */
    public static SearchEntity getInstance(String conf, String form) throws HongsException {
        String code = SearchEntity.class.getName() +":"+ conf +"."+ form;
        Core   core = Core.getInstance( );
        if ( ! core.containsKey( code ) ) {
            String path = conf +"/"+ form;
            String name = conf +"."+ form;
            Map    fxrm = FormSet.getInstance(conf).getForm(form);

            // 表单配置中可指定数据路径
            Map c = (Map) fxrm.get("@");
            if (c!= null) {
                String p;
                p = (String) c.get("db-path");
                if (null != p && p.length() != 0) {
                    path  = p;
                }
                p = (String) c.get("db-name");
                if (null != p && p.length() != 0) {
                    name  = p;
                }
            }

            SearchEntity inst = new SearchEntity(fxrm, path,name);
            core.put( code, inst ) ; return inst ;
        } else {
            return  (SearchEntity) core.got(code);
        }
    }

    @Override
    public IndexWriter getWriter() throws HongsException {
        String dn = /***/ getDbName(  );
        String kn = SearchWriter.class.getName() + ":" + dn ;
        Locker lk = Block.getLocker(kn);
        lk.lock();
        try {
            if (WRITOR != null) {
//              WRITOR.open(  ); // 不计数
                return  WRITOR.conn();
            }
            WRITOR = (SearchWriter) Core.GLOBAL_CORE.get(kn);
            if (WRITOR != null) {
                WRITOR.open(  ); // 需计数
                return  WRITOR.conn();
            }

            String path = getDbPath();
            IndexWriter writer;

            try {
                IndexWriterConfig iwc = new IndexWriterConfig(getAnalyzer());
                iwc.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);

                Directory dir = FSDirectory.open(Paths.get(path));

                writer = new IndexWriter(dir, iwc);
            } catch (IOException x) {
                throw new HongsException.Common(x);
            }

            WRITOR = new SearchWriter(writer , dn);
            Core . GLOBAL_CORE . put (kn , WRITOR);

            return WRITOR.conn();
        } finally {
            lk.unlock();
        }
    }

    @Override
    public void addDoc(Document doc) throws HongsException {
        Locker lk = lock();
        try {
            IndexWriter iw = getWriter();
            try {
                iw.addDocument (doc);
            } catch (IOException ex) {
                throw new HongsException.Common(ex);
            }
        } finally {
            lk.unlock();
        }

        if (!TRNSCT_MODE) {
            commit();
        }
    }

    @Override
    public void setDoc(String id, Document doc) throws HongsException {
        Locker lk = lock();
        try {
            IndexWriter iw = getWriter();
            try {
                iw.updateDocument (new Term(Cnst.ID_KEY, id), doc);
            } catch (IOException ex) {
                throw new HongsException.Common(ex);
            }
        } finally {
            lk.unlock();
        }

        if (!TRNSCT_MODE) {
            commit();
        }
    }

    @Override
    public void delDoc(String id) throws HongsException {
        Locker lk = lock();
        try {
            IndexWriter iw = getWriter();
            try {
                iw.deleteDocuments(new Term(Cnst.ID_KEY, id) /**/);
            } catch (IOException ex) {
                throw new HongsException.Common(ex);
            }
        } finally {
            lk.unlock();
        }

        if (!TRNSCT_MODE) {
            commit();
        }
    }

    /**
     * 提交更改
     */
    @Override
    public void commit() {
        if (WRITOR == null) {
            return;
        }
        TRNSCT_MODE = Synt.declare(Core.getInstance().got(Cnst.TRNSCT_MODE), false);

        Locker lk = lock();
        try {
            IndexWriter iw = WRITOR.conn();
            try {
                iw.commit(  );
            } catch (IOException ex) {
                throw new HongsExemption(0x102c, ex);
            }
        } finally {
            lk.unlock();
        }
    }

    /**
     * 回滚操作
     */
    @Override
    public void revert() {
        if (WRITOR == null) {
            return;
        }
        TRNSCT_MODE = Synt.declare(Core.getInstance().got(Cnst.TRNSCT_MODE), false);

        Locker lk = lock();
        try {
            IndexWriter iw = WRITOR.conn();
            try {
                iw.rollback();
            } catch (IOException ex) {
                throw new HongsExemption(0x102d, ex);
            }
        } finally {
            lk.unlock();
        }
    }

    @Override
    public void close() {
        super.close();

        if (WRITOR == null) {
            return;
        }

        // 默认退出时提交
        if (TRNSCT_MODE) {
            try {
            try {
                commit();
            } catch (Error er ) {
                revert();
                throw er;
            }
            } catch (Error er ) {
                CoreLogger.error(er);
            }
        }

        Locker lk = lock();
        try {
            WRITOR.exit( );
            WRITOR = null ;
        } finally {
            lk.unlock();
        }
    }

    private Block.Locker lock() {
        String kn = SearchWriter.class.getName()
                  + ":" + getDbName(  );
        Locker lk = Block.getLocker(kn);
        lk.lock();
        return lk;
    }

    private static class SearchWriter implements AutoCloseable {

        private IndexWriter writer;
        private String dbname;
        private int c = 1;

        public SearchWriter(IndexWriter writer, String dbname) {
            this.writer = writer;
            this.dbname = dbname;

            if (0 < Core.DEBUG && 4 != ( 4 & Core.DEBUG )) {
                CoreLogger.trace("Start the lucene writer for " + dbname);
            }
        }

        public IndexWriter conn() {
            return this.writer;
        }

        public int  calc() {
            return  c ;
        }

        public void open() {
//          if (c >= 0) {
                c += 1;
//          }
        }

        public void exit() {
            if (c >= 1) {
                c -= 1;
            }
        }

        @Override
        public void close() {
            // 退出时合并索引
            try {
                writer.maybeMerge();
            } catch (IOException x) {
                CoreLogger.error(x);
            }

            try {
                writer.close();
            } catch (IOException x) {
                CoreLogger.error(x);
            } finally {
                writer = null ;
            }

            if (0 < Core.DEBUG && 4 != (4 & Core.DEBUG)) {
                CoreLogger.trace("Close the lucene writer for " + dbname);
            }
        }

    }

    /**
     * 自启一个定时任务,
     * 每隔一段时间清理,
     * 如设为  0 不清理,
     * 默认为 10 分钟
     */
    static {
        long time = Long.parseLong(
                System.getProperty(Block.class.getName()
                        + ".cleans.period" , "600000" ));
        if ( time > 0 ) // 明确设为 0 则不清理
        new Timer(Block.class.getName()+".cleans", true)
        .schedule(new TimerTask() {
            @Override
            public void run() {
                Iterator i = Core.GLOBAL_CORE.entrySet().iterator();
                while  ( i.hasNext() ) {
                    Map.Entry e = ( Map.Entry ) i.next();
                    Object    o = e.getValue( );
                    if (o instanceof SearchWriter) {
                        SearchWriter w = (SearchWriter)o;
                        if (w.calc(  ) == 0 ) {
                            w.close( );
                            i.remove();
                        }
                    }
                }
            }
        }, time, time);
    }

}
