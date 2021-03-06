package io.github.ihongs.action;

import io.github.ihongs.Cnst;
import io.github.ihongs.Core;
import io.github.ihongs.CoreRoster;
import io.github.ihongs.CoreRoster.Mathod;
import io.github.ihongs.HongsError;
import io.github.ihongs.HongsException;
import io.github.ihongs.action.anno.Action;
import io.github.ihongs.action.anno.Assign;
import io.github.ihongs.action.anno.Filter;
import io.github.ihongs.action.anno.FilterInvoker;
import io.github.ihongs.dh.IActing;

import java.util.Map;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.lang.reflect.InvocationTargetException;

/**
 * 动作执行器
 *
 * <h3>异常代码</h3>
 * <pre>
 * 区间: 0x1100~0x110f
 * 0x1100 错误请求
 * 0x1101 尚未登陆
 * 0x1102 区域错误
 * 0x1103 无权访问
 * 0x1104 无此动作
 * 0x1105 非法请求
 * 0x110e 无法执行, 禁止访问或参数错误
 * 0x110f 注解链溢出
 * </pre>
 *
 * @author Hong
 */
public class ActionRunner {
    private int idx = -1 ;
    private String action;
    private final Object   object;
    private final Method   method;
    private final Class<?> mclass;
    private final ActionHelper helper;
    private final Annotation[] annarr;

    public ActionRunner(ActionHelper helper, Object object, String method)
    throws HongsException {
        this.helper = helper;
        this.object = object;
        this.mclass = object.getClass();

        // 从类里面获取方法
        try {
            this.method = this.mclass.getMethod(method, ActionHelper.class);
            this.annarr = this.method.getAnnotations();
        } catch (NoSuchMethodException ex) {
            throw new HongsException(0x1104, "Can not find action '"+ mclass.getName() +"."+ method +"'");
        } catch (    SecurityException ex) {
            throw new HongsException(0x1104, "Can not exec action '"+ mclass.getName() +"."+ method +"'");
        }

        // 从注解中提取动作
        Action a;
        a = this.mclass.getAnnotation(Action.class);
        if (null != a) {
            this.action  = a.value()+"/";
        } else {
            this.action  = /*basic*/ "/";
        }
        a = this.method.getAnnotation(Action.class);
        if (null != a) {
            this.action += a.value();
        }
    }

    public ActionRunner(ActionHelper helper, String action)
    throws HongsException {
        Mathod mt = getActions().get(action);
        if ( null == mt ) {
            throw new HongsException(0x1104, "Can not find action '"+ action +"'");
        }

        this.action = action;
        this.helper = helper;
        this.mclass = mt.getMclass();
        this.method = mt.getMethod();
        this.object = Core.getInstance(mclass);
        this.annarr = method.getAnnotations( );
    }

    /**
     * 获得当前 action 对象
     * @return
     */
    public Object getObject() {
        return object;
    }

    /**
     * 获得当前动作方法对象
     * @return
     */
    public Method getMethod() {
        return method;
    }

    /**
     * 执行动作方法
     * 会执行 action 方法上 annotation 指定的过滤器
     * @throws HongsException
     */
    public void doAction() throws HongsException {
        if ( idx  < 0) {
             idx  = 0 ;
            doInvite();
        } else
        // 如果超出链长度, 则终止执行
        if ( idx  >  annarr.length) {
            throw new HongsException(0x110f, "Action annotation out of index: "
            +idx+">"+annarr.length);
        }

        // 如果已到达链尾, 则执行动作
        if ( idx ==  annarr.length) {
            doInvoke();
            return;
        }

        Filter actw;
        Annotation anno = annarr[idx ++];
        if (anno instanceof Filter) {
            actw = ( Filter ) anno;
        } else {
            actw = anno.annotationType().getAnnotation(Filter.class);
        }

        // 如果不是动作链, 则跳过注解
        if (actw == null) {
            doAction();
            return;
        }

        // 执行注解过滤器
        Class<? extends FilterInvoker> classo = actw.value();
        FilterInvoker filter = Core.getInstance(classo);
        filter.invoke(helper , this, anno);
    }

    /**
     * 执行动作方法
     * 不执行 action 方法上 annotation 指定的过滤器
     * @throws HongsException
     */
    public void doInvoke() throws HongsException {
        if ( idx  < 0) {
             idx  = 0 ;
            doInvite();
        }

        try {
            method.invoke(object, helper);
        } catch (   IllegalAccessException e) {
            throw new HongsException(0x110e, "Illegal access for method '"+mclass.getName()+"."+method.getName()+"(ActionHelper).");
        } catch ( IllegalArgumentException e) {
            throw new HongsException(0x110e, "Illegal params for method '"+mclass.getName()+"."+method.getName()+"(ActionHelper).");
        } catch (InvocationTargetException e) {
            Throwable  ex = e.getCause( );
            if (ex instanceof HongsError) {
                throw (HongsError    ) ex;
            } else
            if (ex instanceof HongsException) {
                throw (HongsException) ex;
            } else {
                throw new HongsException(0x110e, ex);
            }
        }
    }

    /**
     * 执行初始方法
     * 会执行 acting 方法, doAction,doInvoke 内已调
     * @throws HongsException
     */
    public void doInvite()
    throws HongsException {
        // Regist the runner
        helper.setAttribute(ActionRunner.class.getName(), this);

        // Initialize action
        if (object instanceof IActing ) {
           ( ( IActing ) object ).acting( helper, this );
        }
    }

    //** 更方便的获取模块、实体、操作的方式 **/

    private String mod = null;
    private String ent = null;
    private String met = null;
    private String act = null;

    public void setModule(String name) {
        mod = name;
    }
    public void setEntity(String name) {
        ent = name;
    }
    public void setHandle(String name) {
        met = name;
    }

    public String getModule() throws HongsException {
        if (null != mod) {
            return  mod;
        }

        // 从注解提取模块名称
        Assign ing;
        ing = method.getAnnotation(Assign.class);
        if (null != ing) {
            return  ing.conf();
        }
        ing = mclass.getAnnotation(Assign.class);
        if (null != ing) {
            return  ing.conf();
        }

        int pos;
        mod  = getAction();
        pos  = mod.lastIndexOf('/');
        mod  = mod.substring(0,pos); // 去掉动作
        pos  = mod.lastIndexOf('/');
        mod  = mod.substring(0,pos); // 去掉实体
        return mod;
    }

    public String getEntity() throws HongsException {
        if (null != ent) {
            return  ent;
        }

        // 从注解提取实体名称
        Assign ing;
        ing = method.getAnnotation(Assign.class);
        if (null != ing) {
            return  ing.name();
        }
        ing = mclass.getAnnotation(Assign.class);
        if (null != ing) {
            return  ing.name();
        }

        int pos;
        ent  = getAction();
        pos  = ent.lastIndexOf('/');
        ent  = ent.substring(0,pos); // 去掉动作
        pos  = ent.lastIndexOf('/');
        ent  = ent.substring(1+pos); // 得到实体
        return ent;
    }

    public String getHandle() throws HongsException {
        if (null != met) {
            return  met;
        }

        int pos;
        met  = getAction();
        pos  = met.lastIndexOf('/');
        met  = met.substring(1+pos); // 得到动作
        return met;
    }

    /**
     * 获取动作名
     * 外部有指定工作路径(Cnst.ACTION_ATTR)则返回工作动作名
     * 同时可使用 setAction 进行设置
     * @return
     * @throws HongsException
     */
    public String getAction() throws HongsException {
        if (null != act) {
            return  act;
        }

        // 去除路径中的根目录和扩展名
        act = (String) helper.getAttribute(Cnst.ACTION_ATTR);
        if (act != null) {
            int pos = act.lastIndexOf('.');
            if (pos > 0) {
                act = act.substring(0,pos);
            }
            return    act;
        } else {
            return action;
        }
    }

    //** 动作方法 **/

    public static Map<String, Mathod> getActions() {
        return CoreRoster.getActions();
    }

}
