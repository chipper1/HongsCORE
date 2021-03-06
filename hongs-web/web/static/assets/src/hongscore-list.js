
/* global self, Element */

/**
 * 列表组件
 * @param {Object} opts 选项
 * @param {Element} context 容器
 */
function HsList(context, opts) {
    context = jQuery (context);

    var loadBox  = context.closest(".loadbox");
    var listBox  = context.find   (".listbox");
    var pageBox  = context.find   (".pagebox");
    var findBox  = context.find   (".findbox");
    var loadUrl  = hsGetValue(opts, "loadUrl");
    var sendUrls = hsGetValue(opts, "sendUrls");
    var openUrls = hsGetValue(opts, "openUrls");
    var loadDat  = hsGetValue(opts, "loadData");

    // 排序, 分页等参数
    this.sortKey = hsGetValue(opts, "sortKey", hsGetConf("ob.key", "ob"));
    this.pageKey = hsGetValue(opts, "pageKey", hsGetConf("pn.key", "pn"));
    this.pagsKey = hsGetValue(opts, "pagsKey", hsGetConf("gn.key", "gn"));
    this.rowsKey = hsGetValue(opts, "rowsKey", hsGetConf("rn.key", "rn"));
    this.pagsNum = hsGetValue(opts, "pagsNum", hsGetConf("pags.for.page", 5 ));
    this.rowsNum = hsGetValue(opts, "pagsNum", hsGetConf("rows.per.page", 20));

    this.context = context;
    this.loadBox = loadBox;
    this.listBox = listBox;
    this.pageBox = pageBox;
    this._url  = "";
    this._data = [];

    if (opts) for ( var k in opts ) {
        if ('_'===k.substring(0, 1)
        ||  this[k] !== undefined ) {
            this[k]  =  opts[k];
        }
    }

    var that = this;
    var m, n, u;

    //** 发送服务 **/

    function sendHand(evt) {
        var n = jQuery(this);
        var m = evt.data[1];
        var u = evt.data[2];

        var t = n.closest(".tooltip");
        if (t.length) {
            n = t.data   ( "trigger");
        }
        if (typeof(u) === "function") {
            u.call(that, n, m);
            return;
        }

        var c = that.getIds(n);
        if (c == null) return ;

        u = hsFixPms(u, loadBox);
        that.send   (n, m, u, c);
    }

    if (sendUrls) jQuery.each(sendUrls, function(i, a) {
        switch (a.length) {
        case 3:
            u = a[0];
            n = a[1];
            m = a[2];
            break;
        case 2:
            u = a[0];
            n = a[1];
            m = undefined;
            break;
        default:
            return;
        }

        if (typeof(n) !== "string" || /^[@%\^\-+~>*#]/.test(n)) {
            context.hsFind(n).on("click", [n, m, u], sendHand);
        } else {
            context.on("click", n, [n, m, u], sendHand);
        }
    });

    //** 打开服务 **/

    function openHand(evt) {
        var n = jQuery(this);
        var m = evt.data[1];
        var u = evt.data[2];

        switch (m) {
            case "{CONTEXT}": m = context; break;
            case "{LOADBOX}": m = loadBox; break;
            case "{AUTOBOX}": m = '@';
            default: if ( m ) m = n.hsFind(m);
        }

        var t = n.closest(".tooltip");
        if (t.length) {
            n = t.data   ( "trigger");
        }
        if (typeof(u) === "function") {
            u.call(that, n, m);
            return;
        }

        var c = that.getIds(n);
        if (c == null) return ;

        u = hsFixPms(u, loadBox);
        that.open   (n, m, u, c);
    }

    if (openUrls) jQuery.each(openUrls, function(i, a) {
        switch (a.length) {
        case 3:
            u = a[0];
            n = a[1];
            m = a[2];
            break;
        case 2:
            u = a[0];
            n = a[1];
            m = undefined;
            break;
        default:
            return;
        }

        if (typeof(n) !== "string" || /^[@%\^\-+~>*#]/.test(n)) {
            context.hsFind(n).on("click", [n, m, u], openHand);
        } else {
            context.on("click", n, [n, m, u], openHand);
        }
    });

    //** 搜索服务 **/

    if (findBox.length) {
        findBox.on("submit", function() {
            that.load(null , findBox  );
            return   false ;
        });
    }

    //** 立即加载 **/

    if (loadUrl) {
        loadUrl = hsFixPms   (loadUrl, loadBox);
        loadDat = hsSerialMix(loadDat, findBox);
        this.load(/*current*/ loadUrl, loadDat);
    }
}
HsList.prototype = {
    load     : function(url, data) {
        if (url ) this._url  = url;
        if (data) this._data = hsSerialArr(data);
        this.ajax({
            "url"       : this._url ,
            "data"      : this._data,
            "type"      : "POST",
            "dataType"  : "json",
            "funcName"  : "load",
            "cache"     : false,
            "context"   : this,
            "success"   : this.loadBack
        });
    },
    loadBack : function(rst) {
        rst = hsResponse(rst);
        if (rst.ok === false) return;

        this.listBox.trigger("loadBack", [rst, this]);

        var list = rst["list"] || [];
        var page = rst["page"] || {};

        if (! rst.page) {
        if (! rst.list || ! rst.list.length) {
            page = {state: 1}; // 空列表
        } else {
            page = {state:-1}; // 估算量
        }}

        this.fillList(list);
        this.fillPage(page);

        this.listBox.trigger("loadOver", [rst, this]);
    },
    fillList : function(list) {
        var ths, th, tb, tr, td, i, j, n, t, v, f;
        ths = this.listBox.find("thead th,thead td" );
        tb  = this.listBox.find("tbody"); tb.empty( );

        // 排序
        var sn = hsGetSerias(this._data,this.sortKey);
        if (sn.length == 0) {
            sn = hsGetParam (this._url ,this.sortKey);
        } else {
            sn = sn[0];
        }

        for (i = 0; i < ths .length; i ++) {
            th = jQuery(ths[i]);

            // 填充句柄
            f = th.data( "fl" );
            if (f && typeof f != "function") {
                try {
                    f = eval('(null||function(list,v,n){return '+f+';})');
                } catch (e) {
                    throw new Error("Parse list data-fl error: "+e);
                }
                th.data("fl",f);
            }

            // 排序处理
            if (th.hasClass("sortable")) {
                var fn = th.attr("data-ob" )
                      || th.attr("data-fn" );
                this._fill__sort(th, sn, fn);
            }
        }

        this._list = list;
        for (i = 0; i < list.length; i ++) {
            this._info = list[i];
            tr = jQuery('<tr></tr>').appendTo(tb);

            for (j = 0; j < ths .length; j ++) {
                th = jQuery(ths[j]);
                td = jQuery('<td></td>').appendTo(tr);
                td.attr( "class" , th.attr("class") );

                n  = th.data("fn");
                t  = th.data("ft");
                f  = th.data("fl");
                if (n !== undefined) {
                v  = hsGetValue(list[i], n);
                if (v === undefined) {
                    v  =  list[i][n];
                }} else {
                    v  =  undefined ;
                }

                // 调节
                if (f) {
                    v  = f.call(td[0], this, v, n);
                }
                // 填充
                if (n && this["_fill_"+n] !== undefined) {
                    v  = this["_fill_"+n].call(this, td, v, n);
                } else
                if (t && this["_fill_"+t] !== undefined) {
                    v  = this["_fill_"+t].call(this, td, v, n);
                }
                // 无值不理会
                if (! v && v !== 0 && v !== "") {
                    continue;
                }

                td.text( v );
            }
        }

            delete this._list;
        if (typeof(this._info) !== "undefined") {
            delete this._info;
        }
    },
    fillPage : function(page) {
        switch (page.state) {
            case  2 :
            case "2":
                this.pageBox.empty().append('<div class="alert alert-warning" style="width: 100%;">'
                        + (this._above_err || hsGetLang('list.above')) + '</div>');
                this.listBox.hide( );
                var that = this;
                hsSetSeria(this._data, this.pageKey);
                setTimeout(function() {
                    that.load();
                }, 5000);
                return;
            case  1 :
            case "1":
                this.pageBox.empty().append('<div class="alert alert-warning" style="width: 100%;">'
                        + (this._empty_err || hsGetLang('list.empty')) + '</div>');
                this.listBox.hide( );
                return;
            default :
                this.pageBox.empty();
                this.listBox.show( );
        }

        var i, p, t, pmin, pmax, that = this;
        p = page[this.pageKey] ? parseInt(page[this.pageKey]) : 1;
        t = page[this._pc_key] ? parseInt(page[this._pc_key]) : 1;
        pmin = p - Math.floor( this.pagsNum / 2 );
        if (pmin < 1) pmin = 1;
        pmax = pmin + this.pagsNum - 1;
        if (pmax > t) pmax = t;
        pmin = pmax - this.pagsNum + 1;
        if (pmin < 1) pmin = 1;

        var pbox = jQuery('<ul class="pagination pull-left "></ul>').appendTo(this.pageBox);
        var qbox = jQuery( '<p class="page-count pull-right"></p>' ).appendTo(this.pageBox);
        var nums = pbox; //jQuery('<ul class="pagination pull-left "></ul>').appendTo(this.pageBox);
        var btns = pbox; //jQuery('<ul class="pagination pull-right"></ul>').appendTo(this.pageBox);

        if (page.state == -1 && pmax == t - 1) {
            qbox.text(hsGetLang("list.page.unfo", page));
        } else {
            qbox.text(hsGetLang("list.page.info", page));
        }

        if (1 < p) {
            btns.append(jQuery('<li class="page-prev"><a href="javascript:;" data-pn="'+(p-1)+'" title="'+hsGetLang("list.prev.pagi")+'">&laquo;</a></li>'));
        } else {
            btns.append(jQuery('<li class="page-prev disabled"><a href="javascript:;" title="'+hsGetLang("list.prev.page")+'">&laquo;</a></li>'));
        }

        for(i = pmin; i < pmax + 1; i ++) {
            nums.append(jQuery('<li class="page-link'+(i==p ? ' page-curr active':'')+'"><a href="javascript:;" data-pn="'+i+'">'+i+'</a></li>'));
        }

        if (t > p) {
            btns.append(jQuery('<li class="page-next"><a href="javascript:;" data-pn="'+(p+1)+'" title="'+hsGetLang("list.next.pagi")+'">&raquo;</a></li>'));
        } else {
            btns.append(jQuery('<li class="page-next disabled"><a href="javascript:;" title="'+hsGetLang("list.next.page")+'">&raquo;</a></li>'));
        }

        var tm = null;
        var go = function(p) {
            if ( tm ) clearTimeout(tm);
            hsSetSeria(that._data, that.pageKey, p);
            that.load ( );
        };
        var to = function(p) {
            if ( tm ) clearTimeout(tm);
            tm = setTimeout(function() {
                go(p);
            } , 500 );
        };
        this.pageBox.find(".page-link a").on("click", function(ev) {
            go(jQuery(this).attr("data-pn"));
            ev.preventDefault();
        });
        this.pageBox.find(".page-prev a").on("click", function(ev) {
            to(jQuery(this).attr("data-pn"));
            ev.preventDefault();
        });
        this.pageBox.find(".page-next a").on("click", function(ev) {
            to(jQuery(this).attr("data-pn"));
            ev.preventDefault();
        });
        this.pageBox.find(".page-prev a").on("dblclick", function(ev) {
            go(1);
            ev.preventDefault();
        });
        this.pageBox.find(".page-next a").on("dblclick", function(ev) {
            go(t);
            ev.preventDefault();
        });
    },
    _rc_key : "count",
    _pc_key : "pages",

    send     : function(btn, msg, url, data) {
        var that = this;
        var func = function() {
        var dat2 = jQuery.extend({}, hsSerialDat(url), hsSerialDat(data||{}));
        that.ajax({
            "url"       : url ,
            "data"      : data,
            "type"      : "POST",
            "dataType"  : "json",
            "funcName"  : "send",
            "cache"     : false,
            "context"   : that,
            "trigger"   : btn ,
            "success"   : function(rst) {
                this.sendBack(btn, rst, dat2);
            }
        });
        } ;
        if (!msg) {
            func( );
        } else {
            this.warn( msg , "warning", func, null);
        }
    },
    sendBack : function(btn, rst, data) {
        rst = hsResponse(rst, 1);
        if (rst.ok) {
            if (rst.msg) {
                this.note(rst.msg, "success");
            }
        } else {
            if (rst.msg) {
                this.warn(rst.msg, "warning");
            } else {
                this.warn(hsGetLang('error.unkwn'));
            }
            return;
        }

        var evt = jQuery.Event( "sendBack" );
        btn.trigger(evt , [rst, data, this]);
        if (evt.isDefaultPrevented()) return;

        this.load();
    },

    open     : function(btn, box, url, data) {
        // 如果 URL 里有 {ID} 则替换之
        if ( -1 != url.indexOf("{ID}")) {
            var i, idz, ids = [ /**/ ];
            idz  = hsSerialArr( data );
            for(i=0; i<idz.length; i++) {
                ids.push(encodeURIComponent(idz[i].value));
            }
            url  = url.replace("{ID}" , ids.join(  ","  ));
            data = undefined;
        }

        var that = this;
        var dat2 = jQuery.extend({}, hsSerialDat(url), hsSerialDat(data||{}));
        if (box) {
            box.hsOpen(url, data, function() {
               that.openBack(btn, jQuery( this ), dat2 );
            })
            .data("rel", btn.closest(".loadbox").get(0));
        } else {
         jQuery.hsOpen(url, data, function() {
               that.openBack(btn, jQuery( this ), dat2 );
            });
        }
    },
    openBack : function(btn, box, data) {
        var that = this;
        btn.trigger("openBack", [box, data, this]);

        box.on("saveBack", function(evt, rst, rel) {
            var ext = jQuery.Event( "saveBack" );
            ext.relatedTarget = evt.target;
            ext.relatedHsInst = rel /****/;
            btn.trigger(ext , [rst, data, that]);
            if (ext.isDefaultPrevented()) return;

            that.load( );
        });
    },

    ajax : function() {
        return jQuery.hsAjax.apply(self, arguments);
    },
    note : function() {
        return jQuery.hsNote.apply(self, arguments);
    },
    warn : function() {
        return jQuery.hsWarn.apply(self, arguments);
    },

    getAll   : function() {
        var cks = this.context.find(".checkone").filter(":checked");
        if (cks.length == 0) {
            alert(hsGetLang("list.get.all"));
            return null;
        }
        else {
            return cks ;
        }
    },
    getOne   : function() {
        var cks = this.context.find(".checkone").filter(":checked");
        if (cks.length != 1) {
            alert(hsGetLang("list.get.one"));
            return null;
        }
        else {
            return cks ;
        }
    },
    getRow   : function(o) {
        return jQuery(o).closest("tr,.itembox").find(".checkone,[name=id],[data-fn=id],[data-ft=id]");
    },
    getIds   : function(o) {
        if (jQuery.inArray (this.listBox[0], jQuery(o).parents()) != -1) {
            return this.getRow(o);
        }
        else if (jQuery(o).hasClass("for-choose")) {
            return this.getOne( );
        }
        else if (jQuery(o).hasClass("for-checks")) {
            return this.getAll( );
        }
        else {
            return [];
        }
    },

    // /** 填充函数 **/

    _fill__admin : function(td, v, n) {
        this.listBox.find( 'thead th,thead td' ).eq(td.index( ))
            .find(".invisible").clone().removeClass("invisible")
            .appendTo(td);
        jQuery(td).hsInit().find("input:hidden").val(v);
        return false;
    },
    _fill__check : function(td, v, n) {
        jQuery('<input type="checkbox" class="input-checkbox checkone"/>')
            .attr("name" , n).val( v)
            .appendTo(td);
        return false;
    },
    _fill__radio : function(td, v, n) {
        jQuery('<input type="radio" class="input-radio checkone"/>')
            .attr("name" , n).val( v)
            .appendTo(td);
        return false;
    },
    _fill__email : function(td, v, n) {
        if (! v) return v;
        n = "mailto:" + v;
        jQuery('<a target="_blank"></a>')
            .attr("href" , n).text(v)
            .appendTo(td);
        return false;
    },
    _fill__ulink : function(td, v, n) {
        if (! v) return v;
        v = hsFixUri( v );
        jQuery('<a target="_blank"></a>')
            .attr("href" , v).text(v)
            .appendTo(td);
        return false;
    },
    _fill__nlink : function(td, v, n) {
        // 把 a.b[c][] 改为 a-b-c
        n = n.replace(/(\[|\.)/, '-')
             .replace(/(\]|\-$)/, '');
        jQuery('<a href="javascript:;"></a>')
            .addClass("a-"+n).text(v)
            .appendTo(td);
        return false;
    },

    _fill__htime : function(td, v, n) {
        if (v === undefined) return v;
        var d1  =  new Date ();
        var d2  =  hsPrsDate(v, hsGetLang("datetime.format"));
        if (d1.getFullYear() == d2.getFullYear()
        &&  d1.getMonth() == d2.getMonth()
        &&  d1.getDate( ) == d2.getDate()) {
            return hsGetLang("time.today", [
                   hsFmtDate(v, hsGetLang("time.format"))
            ]);
        }
        else {
            return hsFmtDate(v, hsGetLang("date.format"));
        }
    },
    _fill__hdate : function(td, v, n) {
        if (v === undefined) return v;
        var d1  =  new Date ();
        var d2  =  hsPrsDate(v, hsGetLang("date.format"));
        if (d1.getFullYear() == d2.getFullYear()
        &&  d1.getMonth() == d2.getMonth()
        &&  d1.getDate( ) == d2.getDate()) {
            return hsGetLang("date.today");
        }
        else {
            return hsFmtDate(v, hsGetLang("date.format"));
        }
    },
    _fill__datetime : function(td, v, n) {
        if (v === undefined) return v;
        return hsFmtDate(v, hsGetLang("datetime.format"));
    },
    _fill__date : function(td, v, n) {
        if (v === undefined) return v;
        return hsFmtDate(v, hsGetLang("date.format"));
    },
    _fill__time : function(td, v, n) {
        if (v === undefined) return v;
        return hsFmtDate(v, hsGetLang("time.format"));
    },
    _fill__html : function(td, v, n) {
        if (v === undefined) return v;
        jQuery(td).html( v );return false;
    },
    _fill__text : function(td, v, n) {
        if (v === undefined) return v;
        jQuery(td).text( v );return false;
    },

    _fill__sort : function(th, s, n) {
        if (th.find(".sort-ico").size() === 0) {
            var  that = this ;
            th.click( function() {
                var s = null ;
                if (!!th.hasClass("sort-asc")) {
                    s = "-"+n;
                } else
                if (! th.hasClass("sort-esc")) {
                    s = /**/n;
                }
                hsSetSeria(that._data, that.sortKey, s);
//              hsSetSeria(that._data, that.pageKey, 1);
                that.load ( );
            });
            th.append('<span class="sort-ico"></span>');
        }

        th .removeClass( "sort-asc sort-esc" );
        if (s === /**/n) {
            th.addClass( "sort-asc" );
        } else
        if (s === '-'+n) {
            th.addClass( "sort-esc" );
        }
    }
};

/**
 * 这是比 fillList 更简单的卡片式展现方式
 * 需替代 fillList 时, 在初始化参数中加入
 * fillList: hsListFillItem
 * @param {array} list 返回的列表数据
 */
function hsListFillItem(list) {
    var that = this;
    var tt   = this.context.find(".itembox:hidden:first");
    var tr, td, n, t, v, f;

    // _keep_prev 无论何种情况都不清空之前的列表
    // _keep_void 当前数据为空时不清空之前的列表
    if (! this._keep_prev
    ||  !(this._keep_void && list.length == 0 )) {
        this.listBox.children().not(tt).remove();
    }

    this._list = list;
    for (var i = 0 ; i < list.length ; i ++) {
        this._info = list[i];
        tr = tt.clone();
        tr.find("[data-fn],[data-ft],[data-fl]").each(function() {
            td = jQuery (this);
            n  = td.data("fn");
            t  = td.data("ft");
            f  = td.data("fl");
            if (n !== undefined) {
            v  = hsGetValue(list[i], n);
            if (v === undefined) {
                v  =  list[i][n];
            }} else {
                v  =  undefined ;
            }

            // 解析填充方法
            if (f && typeof f != "function") {
                try {
                    f = eval('(null||function(list,v,n){return '+f+';})');
                } catch (e) {
                    throw new Error("Parse list data-fl error: "+e);
                }
                td.data("fl", f);
            }

            // 调整
            if (f) {
                v  = f.call(td[0], that, v, n);
            }
            // 填充
            if (n && that["_fill_"+n] !== undefined) {
                v  = that["_fill_"+n].call(that, td, v, n);
            } else
            if (t && that["_fill_"+t] !== undefined) {
                v  = that["_fill_"+t].call(that, td, v, n);
            }
            // 无值不理会
            if (! v && v !== 0 && v !== "") {
                return;
            }

            td.text(v);
        });
        tr.css( "display", "" );
        this.listBox.append(tr);
    }

        delete this._list;
    if (typeof(this._info) !== "undefined") {
        delete this._info;
    }
}

/**
 * 这是比 fillPage 更简单的上下页导航方式
 * 需替代 fillPage 时, 在初始化参数中加入
 * fillPage: hsListFillNext
 * @param {type} page
 * @return {undefined}
 */
function hsListFillNext(page) {
    switch (page.state) {
        case  1 :
        case "1":
            this.warn(this._empty_err || hsGetLang('list.empty'), "warning");
            return;
        case  2 :
        case "2":
            this.warn(this._above_err || hsGetLang('list.above'), "warning");
            return;
    }

    var r = page[this.rowsKey] ? parseInt(page[this.rowsKey]) : 20;
    var p = page[this.pageKey] ? parseInt(page[this.pageKey]) : 1 ;
    var t = page[this._pc_key] ? parseInt(page[this._pc_key])
        : ( page[this._rc_key] == 0 ? p - 1
        : ( page[this._rc_key] == r ? p + 1
        : p ) );

    // 添加翻页按钮
    var btn = this.pageBox.find("[data-pn]");
    if (btn.size() === 0) {
        this.pageBox
        .append(jQuery(
            '<ul class="pager"></ul>'
        )
        .append(jQuery(
            '<li class="page-prev"><a href="javascript:;" data-pn="">'+hsGetLang('list.prev.page')+'</a></li>'
        ))
        .append(jQuery(
            '<li class="page-curr active"><a href="javascript:;"></a></li>'
        ))
        .append(jQuery(
            '<li class="page-next"><a href="javascript:;" data-pn="">'+hsGetLang('list.next.page')+'</a></li>'
        )));
        btn = this.pageBox.find("[data-pn]");
    }

    // 设置页码参数
    var pag = this.pageBox.find(".page-curr a");
    if (pag.size() === 0) {
        pag = this.pageBox.find(".page-curr"  );
    }
    if (page.state != -1) {
        pag.text(p+"/"+t);
    } else {
        pag.text(p);
    }
    if (p > 1) {
        pag = btn.closest(".page-prev").removeClass("disabled");
        pag.filter("[data-pn]").attr("data-pn", p-1);
        pag.find  ("[data-pn]").attr("data-pn", p-1);
    } else {
        pag = btn.closest(".page-prev").   addClass("disabled");
        pag.filter("[data-pn]").attr("data-pn", 1  );
        pag.find  ("[data-pn]").attr("data-pn", 1  );
    }
    if (p < t) {
        pag = btn.closest(".page-next").removeClass("disabled");
        pag.filter("[data-pn]").attr("data-pn", p+1);
        pag.find  ("[data-pn]").attr("data-pn", p+1);
    } else {
        pag = btn.closest(".page-next").   addClass("disabled");
        pag.filter("[data-pn]").attr("data-pn", t  );
        pag.find  ("[data-pn]").attr("data-pn", t  );
    }

    // 翻页点击事件
    if (! this.pageBox.data("inited")) {
        this.pageBox.data("inited", 1);
        var that = this;
        this.pageBox.on("click", "[data-pn]", function(evt) {
            evt.preventDefault ( );
            var po = jQuery (this);
            var pn = po.data("pn");
            var pk = that.pageKey ;
            if (po.prop( "disabled" )) {
                return;
            }
            hsSetSeria(that._data, pk, pn);
            that.load();
        });
    }
}

jQuery.fn.hsList = function(opts) {
    return this._hsModule(HsList, opts);
};

(function($) {
    $(document)
    .on("click" , ".listbox tbody td",
    function(evt) {
        // 工具按钮有三类, 打开|打开选中|发送选中
        // 打开选中只能选一行, 发送选中可以选多行
        // 复选框太小不便操作, 当点击表格列时单选
        if ($(evt.target).is("a,input,textarea,button,select,option")
        ||  $(this).is(".dont-check")) {
            return;
        }
        var tr = $(this).closest("tr");
        var ck = tr.find(".checkone" );
        if (this  !=  ck.closest("td")[0])
            tr.closest("tbody").find(".checkone:checked").not(ck )
                               .prop( "checked" , false ).change();
        ck.prop("checked", ! ck.prop( "checked" )).change();
    })
    .on("change", ".HsList .checkone",
    function() {
        var box = $(this ).closest(".HsList" );
        var siz = box.find(".checkone").length;
        var len = box.find(".checkone:checked").length;
        var ckd = siz && siz === len ? true : (len && len !== siz ? null : false);
        box.find(".for-choose").prop("disabled", len !== 1);
        box.find(".for-checks").prop("disabled", len === 0);
        box.find(".checkall").prop("choosed", ckd);
    })
    .on("change", ".HsList .checkall",
    function() {
        var box = $(this ).closest(".HsList" );
        var ckd = $(this/**/).prop("checked" );
                  $(this/**/).prop("choosed", ckd);
        box.find(".checkone").prop("checked", ckd).trigger("change");
    })
    .on("loadOver", ".HsList .listbox",
    function() {
        var box = $(this ).closest(".HsList" );
        box.find(".for-choose,.for-checks").prop("disabled" , true );
        box.find(".checkall").prop("choosed", false);
        box.find(".checkone").change();
    });
})(jQuery);
