/*
 * 
 */

/*
 * Created on May 26, 2004
 */
package com.zimbra.cs.service.mail;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.zimbra.common.service.ServiceException;
import com.zimbra.common.soap.MailConstants;
import com.zimbra.common.soap.Element;
import com.zimbra.common.util.Pair;
import com.zimbra.cs.mailbox.Contact;
import com.zimbra.cs.mailbox.Mailbox;
import com.zimbra.cs.mailbox.OperationContext;
import com.zimbra.cs.mailbox.Contact.Attachment;
import com.zimbra.cs.mime.ParsedContact;
import com.zimbra.cs.service.util.ItemId;
import com.zimbra.cs.service.util.ItemIdFormatter;
import com.zimbra.soap.ZimbraSoapContext;

/**
 * @author schemers
 */
public class ModifyContact extends MailDocumentHandler  {

    private static final String[] TARGET_FOLDER_PATH = new String[] { MailConstants.E_CONTACT, MailConstants.A_ID };
    protected String[] getProxiedIdPath(Element request)     { return TARGET_FOLDER_PATH; }
    protected boolean checkMountpointProxy(Element request)  { return false; }

    public Element handle(Element request, Map<String, Object> context) throws ServiceException {
        ZimbraSoapContext zsc = getZimbraSoapContext(context);
        Mailbox mbox = getRequestedMailbox(zsc);
        OperationContext octxt = getOperationContext(zsc, context);
        ItemIdFormatter ifmt = new ItemIdFormatter(zsc);

        boolean replace = request.getAttributeBool(MailConstants.A_REPLACE, false);
        boolean verbose = request.getAttributeBool(MailConstants.A_VERBOSE, true);

        Element cn = request.getElement(MailConstants.E_CONTACT);
        ItemId iid = new ItemId(cn.getAttribute(MailConstants.A_ID), zsc);

        Contact contact = mbox.getContactById(octxt, iid.getId());
        
        ParsedContact pc;
        if (replace) {
            Pair<Map<String,Object>, List<Attachment>> cdata = CreateContact.parseContact(cn, zsc, octxt, contact);
            pc = new ParsedContact(cdata.getFirst(), cdata.getSecond());
        } else {
            Pair<ParsedContact.FieldDeltaList, List<Attachment>> cdata = 
                CreateContact.parseContactMergeMode(cn, zsc, octxt, contact);
            pc = new ParsedContact(contact).modify(cdata.getFirst(), cdata.getSecond());
        }
        
        mbox.modifyContact(octxt, iid.getId(), pc);
        
        Contact con = mbox.getContactById(octxt, iid.getId());
        Element response = zsc.createElement(MailConstants.MODIFY_CONTACT_RESPONSE);
        if (con != null) {
            if (verbose)
                ToXML.encodeContact(response, ifmt, con, true, null);
            else
                response.addElement(MailConstants.E_CONTACT).addAttribute(MailConstants.A_ID, con.getId());
        }
        return response;
    }

    static Map<String, String> parseFields(List<Element> elist) throws ServiceException {
        if (elist == null || elist.isEmpty())
            return null;

        HashMap<String, String> attrs = new HashMap<String, String>();
        for (Element e : elist) {
            String name = e.getAttribute(MailConstants.A_ATTRIBUTE_NAME);
            attrs.put(name, e.getText());
        }
        return attrs;
    }
}
