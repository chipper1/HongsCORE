package app.hongs.serv.matrix;

import app.hongs.Cnst;
import app.hongs.Core;
import app.hongs.HongsException;
import app.hongs.db.DB;
import app.hongs.db.Mtree;
import app.hongs.db.Table;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.util.List;
import java.util.Map;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerConfigurationException;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

/**
 * 单元模型
 * @author Hongs
 */
public class Unit extends Mtree {

    protected String prefix = "manage/data";

    public Unit() throws HongsException {
        this(DB.getInstance("matrix").getTable("unit"));
    }

    public Unit(Table table)
    throws HongsException {
        super(table);
    }

    @Override
    public int add(String id, Map rd) throws HongsException {
        int an = super.add(id, rd);

        // 建立菜单配置
        String name = (String) rd.get("name");
        if (name != null && !"".equals(name)) {
            updateUnitMenu(id, name);
            updateRootMenu(        );
        }

        return an;
    }

    @Override
    public int put(String id, Map rd) throws HongsException {
        int an = super.put(id, rd);

        // 建立菜单配置
        String name = (String) rd.get("name");
        if (name != null && !"".equals(name)) {
            updateUnitMenu(id, name);
            updateRootMenu(        );
        }

        return an;
    }

    public void updateUnitMenu(String id, String name) throws HongsException {
        Document docm = makeDocument();

        Element  root = docm.createElement("root");
        docm.appendChild ( root );

        Element  menu = docm.createElement("menu");
        root.appendChild ( menu );
        menu.setAttribute("disp", name);
        menu.setAttribute("href", prefix+"/"+id+"/");

        Element  incl;

        // 会话
        incl = docm.createElement("rsname");
        root.appendChild ( incl );
        incl.appendChild ( docm.createTextNode("@manage") );

        List<Map> rows;

        // 单元下的表单
        rows = this.db.getTable("form").fetchCase()
            .filter("unit_id = ?", id )
            .select("id")
            .all();
        for (Map row : rows) {
            String fid = row.get("id").toString();
            incl = docm.createElement( "import" );
            menu.appendChild( incl );
            incl.appendChild( docm.createTextNode(prefix+"/"+fid) );
        }

        // 保存
        saveDocument(Core.CONF_PATH+"/"+prefix+"/"+id+Cnst.NAVI_EXT+".xml", docm);
    }

    public void updateRootMenu() throws HongsException {
        Document docm = makeDocument();

        Element  root = docm.createElement("root");
        docm.appendChild ( root );

        Element  incl;

        // 会话
        incl = docm.createElement("rsname");
        root.appendChild ( incl );
        incl.appendChild ( docm.createTextNode("@manage") );

        List<Map> rows;

        // 全部一级单元
        rows = this.table.fetchCase( )
            .filter("pid  = 0")
            .select("id")
            .all();
        for (Map row : rows) {
            String uid = row.get("id").toString();
            incl = docm.createElement( "import" );
            root.appendChild( incl );
            incl.appendChild( docm.createTextNode(prefix+"/"+uid) );
        }

        Element  menu = docm.createElement("menu");
        root.appendChild ( menu );
        menu.setAttribute("disp", "");
        menu.setAttribute("href", "!"+prefix+"/");

        // 一级以下单元
        rows = this.table.fetchCase( )
            .filter("pid != 0")
            .select("id")
            .all();
        for (Map row : rows) {
            String uid = row.get("id").toString();
            incl = docm.createElement( "import" );
            menu.appendChild( incl );
            incl.appendChild( docm.createTextNode(prefix+"/"+uid) );
        }

        saveDocument(Core.CONF_PATH+"/"+prefix+Cnst.NAVI_EXT+".xml", docm);
    }

    private Document makeDocument() throws HongsException {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder        builder = factory.newDocumentBuilder();
            return  builder.newDocument();
        } catch (ParserConfigurationException e) {
            throw new HongsException.Common ( e);
        }
    }

    private void saveDocument(String path, Document docm) throws HongsException {
        File file = new File(path);
        File fold = file.getParentFile();
        if (!fold.exists()) {
             fold.mkdirs();
        }

        TransformerFactory tf = TransformerFactory.newInstance();
        try {
            Transformer tr = tf.newTransformer();
            DOMSource   ds = new DOMSource(docm);
            tr.setOutputProperty(OutputKeys.ENCODING, "utf-8");
            tr.setOutputProperty(OutputKeys.METHOD  , "xml"  );
            tr.setOutputProperty(OutputKeys.INDENT  , "yes"  );
            tr.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "4");

            PrintWriter  pw = new PrintWriter (new FileOutputStream(file));
            StreamResult sr = new StreamResult( pw  );
            tr.transform(ds, sr);
        } catch (TransformerConfigurationException e) {
            throw new HongsException.Common(e);
        } catch (IllegalArgumentException e) {
            throw new HongsException.Common(e);
        } catch (TransformerException  e) {
            throw new HongsException.Common(e);
        } catch (FileNotFoundException e) {
            throw new HongsException.Common(e);
        }
    }

}