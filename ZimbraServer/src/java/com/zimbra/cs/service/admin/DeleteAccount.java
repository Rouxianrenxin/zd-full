/*
 * 
 */

/*
 * Created on Jun 17, 2004
 */
package com.zimbra.cs.service.admin;

import java.util.Map;
import java.util.List;

import com.zimbra.cs.account.Account;
import com.zimbra.cs.account.AccountServiceException;
import com.zimbra.cs.account.Provisioning;
import com.zimbra.cs.account.Provisioning.AccountBy;
import com.zimbra.cs.account.ZAttrProvisioning.AccountStatus;
import com.zimbra.cs.account.accesscontrol.AdminRight;
import com.zimbra.cs.account.accesscontrol.Rights.Admin;
import com.zimbra.cs.im.IMPersona;
import com.zimbra.cs.mailbox.Mailbox;
import com.zimbra.cs.mailbox.MailboxManager;
import com.zimbra.common.service.ServiceException;
import com.zimbra.common.util.ZimbraLog;
import com.zimbra.common.soap.AdminConstants;
import com.zimbra.common.soap.Element;
import com.zimbra.soap.ZimbraSoapContext;

/**
 * @author schemers
 */
public class DeleteAccount extends AdminDocumentHandler {

    private static final String[] TARGET_ACCOUNT_PATH = new String[] { AdminConstants.E_ID };
    protected String[] getProxiedAccountPath()  { return TARGET_ACCOUNT_PATH; }

    /**
     * must be careful and only allow deletes domain admin has access to
     */
    public boolean domainAuthSufficient(Map context) {
        return true;
    }

    /**
     * Deletes an account and its mailbox.
     */
    public Element handle(Element request, Map<String, Object> context) throws ServiceException {
        ZimbraSoapContext zsc = getZimbraSoapContext(context);
        Provisioning prov = Provisioning.getInstance();

        String id = request.getAttribute(AdminConstants.E_ID);

        // Confirm that the account exists and that the mailbox is located
        // on the current host
        Account account = prov.get(AccountBy.id, id, zsc.getAuthToken());
        if (account == null)
            throw AccountServiceException.NO_SUCH_ACCOUNT(id);

        checkAccountRight(zsc, account, Admin.R_deleteAccount);        

        /*
         * bug 69009
         * 
         * We delete the mailbox before deleting the LDAP entry.
         * It's possible that a message delivery or other user action could 
         * cause the mailbox to be recreated between the mailbox delete step 
         * and the LDAP delete step.
         * 
         * To prevent this race condition, put the account in "maintenance" mode 
         * so mail delivery and any user action is blocked.  
         */ 
        prov.modifyAccountStatus(account, AccountStatus.maintenance.name());
        
        Mailbox mbox = Provisioning.onLocalServer(account) ? 
                MailboxManager.getInstance().getMailboxByAccount(account, false) : null;
                
        if (mbox != null)
            mbox.deleteMailbox();
        IMPersona.deleteIMPersona(account.getName());
        prov.deleteAccount(id);
        ZimbraLog.security.info(ZimbraLog.encodeAttrs(
            new String[] {"cmd", "DeleteAccount","name", account.getName(), "id", account.getId()}));

        Element response = zsc.createElement(AdminConstants.DELETE_ACCOUNT_RESPONSE);
        return response;
    }
    
    @Override
    public void docRights(List<AdminRight> relatedRights, List<String> notes) {
        relatedRights.add(Admin.R_deleteAccount);
    }
    
}