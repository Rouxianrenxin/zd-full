/*
 * 
 */
package com.zimbra.qa.unittest;

import junit.framework.TestCase;

import com.zimbra.common.util.ZimbraLog;
import com.zimbra.cs.db.DbPool;
import com.zimbra.cs.db.DbPool.Connection;


public class TestConnectionPool 
extends TestCase {

    /**
     * Confirms that getting and closing connections properly increments
     * and decrements the pool size.  Also confirms that maintenance
     * connections don't affect the connection pool.
     */
    public void testPool()
    throws Exception {
        int initialSize = DbPool.getSize();

        ZimbraLog.test.info("Initial connection pool size: %d", initialSize);
        
        Connection conn1 = DbPool.getConnection();
        assertEquals("After first connection", initialSize + 1, DbPool.getSize());
        
        Connection conn2 = DbPool.getConnection();
        assertEquals("After second connection", initialSize + 2, DbPool.getSize());
        
        Connection maint = DbPool.getMaintenanceConnection();
        assertEquals("After maintenance connection", initialSize + 2, DbPool.getSize());
        
        DbPool.quietClose(conn1);
        assertEquals("After first close", initialSize + 1, DbPool.getSize());
        
        DbPool.quietClose(conn2);
        assertEquals("After second close", initialSize, DbPool.getSize());
        
        DbPool.quietClose(maint);
        assertEquals("After closing maintenance connection", initialSize, DbPool.getSize());
        
        ZimbraLog.test.info("Final connection pool size: %d", DbPool.getSize());
    }
}
