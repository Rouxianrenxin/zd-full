/*
 * 
 */
package com.zimbra.qa.unittest.server;

import junit.framework.TestCase;

import com.zimbra.cs.account.Account;
import com.zimbra.cs.account.Cos;
import com.zimbra.cs.account.DataSource.ConnectionType;
import com.zimbra.cs.account.Provisioning;
import com.zimbra.cs.account.Server;
import com.zimbra.cs.account.ldap.LdapUtil;
import com.zimbra.cs.datasource.DataSourceManager;
import com.zimbra.cs.mailbox.Mailbox;
import com.zimbra.cs.mailbox.ScheduledTask;
import com.zimbra.cs.zclient.ZFolder;
import com.zimbra.cs.zclient.ZImapDataSource;
import com.zimbra.cs.zclient.ZMailbox;
import com.zimbra.qa.unittest.TestUtil;

public class TestDataSourceServer extends TestCase {

    private static final String USER_NAME = "user1";
    private static final String TEST_USER_NAME = "testdatasource";
    private static final String NAME_PREFIX = TestDataSourceServer.class.getSimpleName();
    
    private String mOriginalAccountPollingInterval;
    private String mOriginalAccountPop3PollingInterval;
    private String mOriginalAccountImapPollingInterval;
    
    private String mOriginalCosPollingInterval;
    private String mOriginalCosPop3PollingInterval;
    private String mOriginalCosImapPollingInterval;
    
    public void setUp()
    throws Exception {
        cleanUp();

        // Remember original polling intervals.
        Account account = TestUtil.getAccount(USER_NAME);
        Cos cos = account.getCOS();
        mOriginalAccountPollingInterval = account.getAttr(Provisioning.A_zimbraDataSourcePollingInterval, false);
        if (mOriginalAccountPollingInterval == null) {
            mOriginalAccountPollingInterval = "";
        }
        mOriginalAccountPop3PollingInterval = account.getAttr(Provisioning.A_zimbraDataSourcePop3PollingInterval, false);
        if (mOriginalAccountPop3PollingInterval == null) {
            mOriginalAccountPop3PollingInterval = "";
        }
        mOriginalAccountImapPollingInterval = account.getAttr(Provisioning.A_zimbraDataSourceImapPollingInterval, false);
        if (mOriginalAccountImapPollingInterval == null) {
            mOriginalAccountImapPollingInterval = "";
        }
        
        mOriginalCosPollingInterval = cos.getAttr(Provisioning.A_zimbraDataSourcePollingInterval, "");
        mOriginalCosPop3PollingInterval = cos.getAttr(Provisioning.A_zimbraDataSourcePop3PollingInterval, "");
        mOriginalCosImapPollingInterval = cos.getAttr(Provisioning.A_zimbraDataSourceImapPollingInterval, "");
    }
    
    public void testScheduling()
    throws Exception {
        // Create data source.
        ZMailbox zmbox = TestUtil.getZMailbox(USER_NAME);
        ZFolder folder = TestUtil.createFolder(zmbox, "/" + NAME_PREFIX + "-testScheduling");
        Provisioning prov = Provisioning.getInstance();
        Server server = prov.getLocalServer();
        int port = server.getImapBindPort();
        ZImapDataSource zds = new ZImapDataSource(NAME_PREFIX + " testScheduling", true, "localhost", port,
            "user2", "test123", folder.getId(), ConnectionType.cleartext);
        String dsId = zmbox.createDataSource(zds);
        
        // Test scheduling based on polling interval. 
        Mailbox mbox = TestUtil.getMailbox(USER_NAME);
        String attrName = Provisioning.A_zimbraDataSourcePollingInterval;
        String imapAttrName = Provisioning.A_zimbraDataSourceImapPollingInterval;
        TestUtil.setDataSourceAttr(USER_NAME, zds.getName(), attrName, "0");
        checkSchedule(mbox, dsId, null);
        
        TestUtil.setDataSourceAttr(USER_NAME, zds.getName(), attrName, "10m");
        checkSchedule(mbox, dsId, 600000);

        TestUtil.setAccountAttr(USER_NAME, imapAttrName, "");
        TestUtil.setDataSourceAttr(USER_NAME, zds.getName(), attrName, "");
        checkSchedule(mbox, dsId, null);
        
        TestUtil.setAccountAttr(USER_NAME, imapAttrName, "5m");
        checkSchedule(mbox, dsId, 300000);
        
        TestUtil.setDataSourceAttr(USER_NAME, zds.getName(), attrName, "0");
        checkSchedule(mbox, dsId, null);
        
        // Bug 44502: test changing polling interval from 0 to unset when
        // interval is set on the account.
        TestUtil.setDataSourceAttr(USER_NAME, zds.getName(), attrName, "");
        checkSchedule(mbox, dsId, 300000);
        
        TestUtil.setDataSourceAttr(USER_NAME, zds.getName(), Provisioning.A_zimbraDataSourceEnabled, LdapUtil.LDAP_FALSE);
        checkSchedule(mbox, dsId, null);
    }
    
    private void checkSchedule(Mailbox mbox, String dataSourceId, Integer intervalMillis)
    throws Exception {
        ScheduledTask task = DataSourceManager.getTask(mbox, dataSourceId);
        if (intervalMillis == null) {
            assertNull(task);
        } else {
            assertEquals(intervalMillis.longValue(), task.getIntervalMillis());
        }
    }
    
    public void tearDown()
    throws Exception {
        // Reset original polling intervals.
        Account account = TestUtil.getAccount(USER_NAME);
        Cos cos = account.getCOS();
        
        account.setDataSourcePollingInterval(mOriginalAccountPollingInterval);
        account.setDataSourcePop3PollingInterval(mOriginalAccountPop3PollingInterval);
        account.setDataSourceImapPollingInterval(mOriginalAccountImapPollingInterval);
        
        cos.setDataSourcePollingInterval(mOriginalCosPollingInterval);
        cos.setDataSourcePop3PollingInterval(mOriginalCosPop3PollingInterval);
        cos.setDataSourceImapPollingInterval(mOriginalCosImapPollingInterval);
        
        cleanUp();
    }
    
    public void cleanUp()
    throws Exception {
        TestUtil.deleteAccount(TEST_USER_NAME);
        TestUtil.deleteTestData(USER_NAME, NAME_PREFIX);
    }
}
