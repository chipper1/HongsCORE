package io.github.ihongs.dh.lucene.query;

import io.github.ihongs.util.Synt;
import org.apache.lucene.index.Term;
import org.apache.lucene.search.Query;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TermRangeQuery;

/**
 *
 * @author Hongs
 */
public class StringQuery implements IQuery {
    @Override
    public Query get(String k, Object v) {
        if (null == v) {
            return  new SearchQuery( ).get(k, v);
        }
        Query  q2 = new TermQuery(new Term(k, v.toString()));
        return q2 ;
    }
    @Override
    public Query get(String k, Object n, Object x, boolean l, boolean g) {
        String n2 = Synt.declare(n, "");
        String x2 = Synt.declare(n, "");
        Query  q2 = TermRangeQuery.newStringRange( k , n2 , x2 , l , g );
        return q2 ;
    }
}
