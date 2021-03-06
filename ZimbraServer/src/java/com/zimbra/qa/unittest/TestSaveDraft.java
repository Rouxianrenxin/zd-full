/*
 * 
 */

package com.zimbra.qa.unittest;

import com.zimbra.cs.mailbox.Mailbox;
import com.zimbra.cs.zclient.ZIdentity;
import com.zimbra.cs.zclient.ZMailbox;
import com.zimbra.cs.zclient.ZMailbox.ZOutgoingMessage;
import com.zimbra.cs.zclient.ZMessage;

import junit.framework.TestCase;

public class TestSaveDraft extends TestCase {

    private static final String USER_NAME = "user1";
    private static final String NAME_PREFIX = TestSaveDraft.class.getName();
    
    public void setUp()
    throws Exception {
        cleanUp();
    }
    
    /**
     * Confirms that we update the identity id during a SaveDraft operation (bug 60066).
     */
    public void testIdentityId()
    throws Exception {
        ZMailbox mbox = TestUtil.getZMailbox(USER_NAME);
        
        // Save initial draft.
        ZOutgoingMessage outgoing = TestUtil.getOutgoingMessage(USER_NAME, NAME_PREFIX + " testIdentityId", "testIdentityId", null);
        ZIdentity ident = TestUtil.getDefaultIdentity(mbox);
        outgoing.setIdentityId(ident.getId());
        ZMessage msg = mbox.saveDraft(outgoing, null, Integer.toString(Mailbox.ID_FOLDER_DRAFTS));
        assertEquals(ident.getId(), msg.getIdentityId());
        
        // Save another draft with a new identity id.
        outgoing.setIdentityId("xyz");
        msg = mbox.saveDraft(outgoing, msg.getId(), Integer.toString(Mailbox.ID_FOLDER_DRAFTS));
        assertEquals("xyz", msg.getIdentityId());
        
        // Unset identity id.
        outgoing.setIdentityId("");
        msg = mbox.saveDraft(outgoing, msg.getId(), Integer.toString(Mailbox.ID_FOLDER_DRAFTS));
        assertEquals(null, msg.getIdentityId());
    }
    
    public void tearDown()
    throws Exception {
        cleanUp();
    }
    
    private void cleanUp()
    throws Exception {
        TestUtil.deleteTestData(USER_NAME, NAME_PREFIX);
    }
    
    public static void main(String[] args)
    throws Exception {
        TestUtil.cliSetup();
        TestUtil.runTest(TestSaveDraft.class);
    }
}
