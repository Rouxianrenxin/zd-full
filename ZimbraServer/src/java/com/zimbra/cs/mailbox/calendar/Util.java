/*
 * 
 */

package com.zimbra.cs.mailbox.calendar;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import com.zimbra.common.calendar.TZIDMapper;
import com.zimbra.common.service.ServiceException;
import com.zimbra.cs.account.Account;
import com.zimbra.cs.account.Provisioning;
import com.zimbra.cs.mailbox.Metadata;
import com.zimbra.cs.mailbox.calendar.ZCalendar.ICalTok;
import com.zimbra.cs.mailbox.calendar.ZCalendar.ZParameter;
import com.zimbra.cs.mailbox.calendar.ZCalendar.ZProperty;

public class Util {

    private static final String FN_NAME     = "n";
    private static final String FN_NUM_XPROPS_OR_XPARAMS = "numX";
    private static final String FN_VALUE    = "v";
    private static final String FN_XPROP_OR_XPARAM   = "x";

    public static void encodeXParamsAsMetadata(Metadata meta, Iterator<ZParameter> xparamsIter) {
        int xparamCount = 0;
        for (; xparamsIter.hasNext(); ) {
            ZParameter xparam = xparamsIter.next();
            String paramName = xparam.getName();
            if (paramName == null) continue;
            Metadata paramMeta = new Metadata();
            paramMeta.put(FN_NAME, paramName);
            String paramValue = xparam.getValue();
            if (paramValue != null)
                paramMeta.put(FN_VALUE, paramValue);
            meta.put(FN_XPROP_OR_XPARAM + xparamCount, paramMeta);
            xparamCount++;
        }
        if (xparamCount > 0)
            meta.put(FN_NUM_XPROPS_OR_XPARAMS, xparamCount);
    }

    public static void encodeXPropsAsMetadata(Metadata meta, Iterator<ZProperty> xpropsIter) {
        int xpropCount = 0;
        for (; xpropsIter.hasNext(); ) {
            ZProperty xprop = xpropsIter.next();
            String propName = xprop.getName();
            if (propName == null) continue;
            // Never persist the transport-only special x-prop X-ZIMBRA-CHANGES.
            if (propName.equalsIgnoreCase(ICalTok.X_ZIMBRA_CHANGES.toString())) continue;
            Metadata propMeta = new Metadata();
            propMeta.put(FN_NAME, propName);
            String propValue = xprop.getValue();
            if (propValue != null)
                propMeta.put(FN_VALUE, propValue);

            encodeXParamsAsMetadata(propMeta, xprop.parameterIterator());

            meta.put(FN_XPROP_OR_XPARAM + xpropCount, propMeta);
            xpropCount++;
        }
        if (xpropCount > 0)
            meta.put(FN_NUM_XPROPS_OR_XPARAMS, xpropCount);
    }

    public static List<ZParameter> decodeXParamsFromMetadata(Metadata meta) throws ServiceException {
        int xparamCount = (int) meta.getLong(FN_NUM_XPROPS_OR_XPARAMS, 0);
        if (xparamCount > 0) {
            List<ZParameter> list = new ArrayList<ZParameter>(xparamCount);
            for (int paramNum = 0; paramNum < xparamCount; paramNum++) {
                Metadata paramMeta = meta.getMap(FN_XPROP_OR_XPARAM + paramNum, true);
                if (paramMeta == null) continue;
                String paramName = paramMeta.get(FN_NAME, null);
                if (paramName == null) continue;
                String paramValue = paramMeta.get(FN_VALUE, null);
                ZParameter xparam = new ZParameter(paramName, paramValue);
                list.add(xparam);
            }
            return list;
        }
        return null;
    }

    public static List<ZProperty> decodeXPropsFromMetadata(Metadata meta) throws ServiceException {
        int xpropCount = (int) meta.getLong(FN_NUM_XPROPS_OR_XPARAMS, 0);
        if (xpropCount > 0) {
            List<ZProperty> list = new ArrayList<ZProperty>(xpropCount);
            for (int propNum = 0; propNum < xpropCount; propNum++) {
                Metadata propMeta = meta.getMap(FN_XPROP_OR_XPARAM + propNum, true);
                if (propMeta == null) continue;
                String propName = propMeta.get(FN_NAME, null);
                if (propName == null) continue;
                // Never persist the transport-only special x-prop X-ZIMBRA-CHANGES.
                if (propName.equalsIgnoreCase(ICalTok.X_ZIMBRA_CHANGES.toString())) continue;
                ZProperty xprop = new ZProperty(propName);
                String propValue = propMeta.get(FN_VALUE, null);
                if (propValue != null)
                    xprop.setValue(propValue);
                List<ZParameter> xparams = decodeXParamsFromMetadata(propMeta);
                if (xparams != null) {
                    for (ZParameter xparam : xparams) {
                        xprop.addParameter(xparam);
                    }
                }
                list.add(xprop);
            }
            return list;
        }
        return null;
    }
    
    /**
     * Returns the time zone for the given account.
     */
    public static ICalTimeZone getAccountTimeZone(Account account) {
        String tzid = account.getAttr(Provisioning.A_zimbraPrefTimeZoneId);
        tzid = TZIDMapper.canonicalize(tzid);
        ICalTimeZone timeZone = WellKnownTimeZones.getTimeZoneById(tzid);
        if (timeZone == null) {
            return ICalTimeZone.getUTC();
        }
        return timeZone;
    }
}
