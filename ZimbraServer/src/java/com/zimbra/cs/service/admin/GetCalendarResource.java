/*
 * 
 */

package com.zimbra.cs.service.admin;

import java.util.List;
import java.util.Map;
import java.util.Set;

import com.zimbra.common.service.ServiceException;
import com.zimbra.common.soap.AdminConstants;
import com.zimbra.common.soap.Element;
import com.zimbra.cs.account.AccountServiceException;
import com.zimbra.cs.account.AttributeClass;
import com.zimbra.cs.account.CalendarResource;
import com.zimbra.cs.account.Provisioning;
import com.zimbra.cs.account.Provisioning.CalendarResourceBy;
import com.zimbra.cs.account.accesscontrol.AdminRight;
import com.zimbra.cs.account.accesscontrol.Rights.Admin;
import com.zimbra.soap.ZimbraSoapContext;

/**
 * @author jhahm
 */
public class GetCalendarResource extends AdminDocumentHandler {

    private static final String[] TARGET_RESOURCE_PATH = new String[] { AdminConstants.E_CALENDAR_RESOURCE };
    protected String[] getProxiedResourceElementPath()  { return TARGET_RESOURCE_PATH; }

    /**
     * must be careful and only return calendar resources
     * a domain admin can see
     */
    public boolean domainAuthSufficient(Map context) {
        return true;
    }

    public Element handle(Element request, Map<String, Object> context)
    throws ServiceException {
        ZimbraSoapContext zsc = getZimbraSoapContext(context);
        Provisioning prov = Provisioning.getInstance();

        boolean applyCos = request.getAttributeBool(AdminConstants.A_APPLY_COS, true);
        Set<String> reqAttrs = getReqAttrs(request, AttributeClass.calendarResource);
        
        Element cr = request.getElement(AdminConstants.E_CALENDAR_RESOURCE);
        String key = cr.getAttribute(AdminConstants.A_BY);
        String value = cr.getText();

        CalendarResource resource = prov.get(CalendarResourceBy.fromString(key), value);

        if (resource == null)
            throw AccountServiceException.NO_SUCH_CALENDAR_RESOURCE(value);

        AdminAccessControl aac = checkCalendarResourceRight(zsc, resource, AdminRight.PR_ALWAYS_ALLOW);
        
        Element response = zsc.createElement(AdminConstants.GET_CALENDAR_RESOURCE_RESPONSE);
        ToXML.encodeCalendarResource(response, resource, applyCos, reqAttrs, aac.getAttrRightChecker(resource));

        return response;
    }
    
    @Override
    public void docRights(List<AdminRight> relatedRights, List<String> notes) {
        relatedRights.add(Admin.R_getCalendarResource);
        notes.add(String.format(AdminRightCheckPoint.Notes.GET_ENTRY, Admin.R_getCalendarResource.getName()));
    }
}
