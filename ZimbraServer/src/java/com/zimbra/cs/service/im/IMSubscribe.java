/*
 * 
 */
package com.zimbra.cs.service.im;

import java.util.Map;

import com.zimbra.common.service.ServiceException;
import com.zimbra.common.soap.IMConstants;
import com.zimbra.common.soap.Element;
import com.zimbra.cs.im.IMAddr;
import com.zimbra.cs.im.IMPersona;
import com.zimbra.cs.im.IMUtils;
import com.zimbra.cs.mailbox.OperationContext;
import com.zimbra.soap.ZimbraSoapContext;

public class IMSubscribe extends IMDocumentHandler {

    @Override
    public Element handle(Element request, Map<String, Object> context) throws ServiceException {
        ZimbraSoapContext zsc = getZimbraSoapContext(context);
        OperationContext octxt = getOperationContext(zsc, context);

        String op = request.getAttribute(IMConstants.A_OPERATION);
        boolean add = true;
        if (op.equalsIgnoreCase("remove")) 
            add = false;

        String addrStr = request.getAttribute(IMConstants.A_ADDRESS);
        String resolvedAddr = IMUtils.resolveAddress(addrStr);
        IMAddr addr = new IMAddr(resolvedAddr);
        
        Element response = zsc.createElement(IMConstants.IM_SUBSCRIBE_RESPONSE);
        response.addAttribute(IMConstants.A_ADDRESS, addr.toString());

        String name = request.getAttribute(IMConstants.A_NAME, "");
        String groupStr = request.getAttribute(IMConstants.A_GROUPS, null);
        String[] groups;
        if (groupStr != null) 
            groups = groupStr.split(",");
        else
            groups = new String[0];

        IMPersona persona = super.getRequestedPersona(zsc);
        synchronized (persona.getLock()) {
            if (add) 
                persona.addOutgoingSubscription(octxt, addr, name, groups);
            else
                persona.removeOutgoingSubscription(octxt, addr, name, groups);
        }

        return response;
    }
    
}
