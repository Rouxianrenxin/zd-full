/*
 * 
 */
package com.zimbra.cs.service.admin;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.zimbra.common.service.ServiceException;
import com.zimbra.cs.account.Account;
import com.zimbra.cs.account.AccountServiceException;
import com.zimbra.cs.account.AttributeClass;
import com.zimbra.cs.account.AttributeManager;
import com.zimbra.cs.account.DataSource;

import com.zimbra.cs.account.Provisioning;
import com.zimbra.cs.account.Provisioning.AccountBy;
import com.zimbra.cs.account.Provisioning.DataSourceBy;
import com.zimbra.cs.account.accesscontrol.AdminRight;
import com.zimbra.cs.account.accesscontrol.Rights.Admin;
import com.zimbra.cs.datasource.DataSourceManager;
import com.zimbra.common.soap.*;
import com.zimbra.common.util.ZimbraLog;
import com.zimbra.soap.ZimbraSoapContext;

public class ModifyDataSource extends AdminDocumentHandler {

    private static final String[] TARGET_ACCOUNT_PATH = new String[] { AdminConstants.E_ID };
    protected String[] getProxiedAccountPath()  { return TARGET_ACCOUNT_PATH; }

    /**
     * must be careful and only allow modifies to accounts/attrs domain admin has access to
     */
    public boolean domainAuthSufficient(Map context) {
        return true;
    }
    
    public Element handle(Element request, Map<String, Object> context) throws ServiceException, SoapFaultException {
        ZimbraSoapContext zsc = getZimbraSoapContext(context);
        Provisioning prov = Provisioning.getInstance();

        String id = request.getAttribute(AdminConstants.E_ID);

        Account account = prov.get(AccountBy.id, id, zsc.getAuthToken());
        if (account == null)
            throw AccountServiceException.NO_SUCH_ACCOUNT(id);

        checkAdminLoginAsRight(zsc, prov, account);
        
        Element dsEl = request.getElement(AccountConstants.E_DATA_SOURCE);
        Map<String, Object> attrs = AdminService.getAttrs(dsEl);
        
        String dsId = dsEl.getAttribute(AccountConstants.A_ID);
        DataSource ds = prov.get(account, DataSourceBy.id, dsId);
        if (ds == null)
            throw ServiceException.INVALID_REQUEST("Cannot find data source with id=" + dsId, null);
        
        DataSource.Type type = ds.getType();
        
        // Note: isDomainAdminOnly *always* returns false for pure ACL based AccessManager 
        if (isDomainAdminOnly(zsc)) {
            // yuck, can't really integrate into AdminDocumentHandler methods
            // have to check separately here
            AttributeClass klass = ModifyDataSource.getAttributeClassFromType(type);
            checkModifyAttrs(zsc, klass, attrs);
        }
        
        ZimbraLog.addDataSourceNameToContext(ds.getName());
        
        prov.modifyDataSource(account, dsId, attrs);
        
        Element response = zsc.createElement(AdminConstants.MODIFY_DATA_SOURCE_RESPONSE);
        return response;
    }
    
    static AttributeClass getAttributeClassFromType(DataSource.Type type) {
        if (type == DataSource.Type.pop3)
            return AttributeClass.pop3DataSource;
        else if (type == DataSource.Type.imap)
            return AttributeClass.imapDataSource;
        else if (type == DataSource.Type.rss)
            return AttributeClass.rssDataSource;
        else if (type == DataSource.Type.gal)
            return AttributeClass.galDataSource;
        else
            return AttributeClass.dataSource;
    }
    
    @Override
    public void docRights(List<AdminRight> relatedRights, List<String> notes) {
        relatedRights.add(Admin.R_adminLoginAs);
        relatedRights.add(Admin.R_adminLoginCalendarResourceAs);
        notes.add(AdminRightCheckPoint.Notes.ADMIN_LOGIN_AS);
    }
}
