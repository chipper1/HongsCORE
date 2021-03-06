package io.github.ihongs.dh.lucene.field;

import org.apache.lucene.document.Field;
import org.apache.lucene.document.TextField;

/**
 *
 * @author Hongs
 */
public class SearchFiald implements IField {
    @Override
    public Field whr(String k, Object v) {
        return null; // 文本类型无法用于过滤, 无法增加过滤字段
    }
    @Override
    public Field odr(String k, Object v) {
        return null; // 文本类型无法用于排序, 无法增加排序字段
    }
    @Override
    public Field get(String k, Object v, boolean u) {
        return new   TextField(k, v != null ? v.toString() : "", u ? Field.Store.NO : Field.Store.YES);
    }
}
