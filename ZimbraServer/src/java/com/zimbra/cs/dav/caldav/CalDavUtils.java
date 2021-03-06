/*
 * 
 */
package com.zimbra.cs.dav.caldav;

import java.util.Iterator;

import com.zimbra.cs.localconfig.DebugConfig;
import com.zimbra.cs.mailbox.calendar.ZCalendar.ICalTok;
import com.zimbra.cs.mailbox.calendar.ZCalendar.ZComponent;
import com.zimbra.cs.mailbox.calendar.ZCalendar.ZProperty;
import com.zimbra.cs.mailbox.calendar.ZCalendar.ZVCalendar;

public class CalDavUtils {

    // Fixup for ATTENDEE properties set by Apple iCal
    // Don't let the organizer to be also listed as an attendee.
    public static void removeAttendeeForOrganizer(ZComponent comp) {
        if (!DebugConfig.caldavAllowAttendeeForOrganizer &&
            (ICalTok.VEVENT.equals(comp.getTok()) || ICalTok.VTODO.equals(comp.getTok()))) {
            String organizer = comp.getPropVal(ICalTok.ORGANIZER, null);
            if (organizer != null) {
                organizer = organizer.trim();
                for (Iterator<ZProperty> propIter = comp.getPropertyIterator(); propIter.hasNext(); ) {
                    ZProperty prop = propIter.next();
                    if (ICalTok.ATTENDEE.equals(prop.getToken())) {
                        String att = prop.getValue();
                        if (att != null) {
                            att = att.trim();
                            if (att.equalsIgnoreCase(organizer)) {
                                // iCal has a habit of listing the organizer as an ATTENDEE.  Undo it.
                                propIter.remove();
                            }
                        } else {
                            // We haven't seen this case occur, but just in case.
                            propIter.remove();
                        }
                    }
                }
            }
        }
    }

    public static void removeAttendeeForOrganizer(ZVCalendar cal) {
        for (Iterator<ZComponent> compIter = cal.getComponentIterator(); compIter.hasNext(); ) {
            removeAttendeeForOrganizer(compIter.next());
        }
    }
    
    public static void adjustPercentCompleteForToDos(ZVCalendar cal) {
        for (Iterator<ZComponent> compIter = cal.getComponentIterator(); compIter.hasNext(); ) {
            ZComponent comp = compIter.next();
            if (ICalTok.VTODO.equals(comp.getTok()))
                adjustPercentCompleteForTodo(comp);
        }
    }
    
    private static void adjustPercentCompleteForTodo(ZComponent comp) {
        boolean isCompleted = false;
        if (comp.getProperty(ICalTok.COMPLETED) != null)
            isCompleted = true;
        else {
            ZProperty status = comp.getProperty(ICalTok.STATUS);
            if (status != null && status.getValue().equals(ICalTok.COMPLETED.toString()))
                isCompleted = true;
        }
        if (!isCompleted) {
            // iCal5 doesn't have a percent-complete field in the UI, but it preserves that
            // attribute when present. When the todo is made incomplete in iCal it unsets the
            // COMPLETED datetime but preserves the percent-complete which can be 100.
            // Reset percentcomplete if it is 100, so that todo does not get treated as 
            // completed down the line.
            ZProperty percentComplete = comp.getProperty(ICalTok.PERCENT_COMPLETE);
            if (percentComplete != null && percentComplete.getIntValue() == 100)
                percentComplete.setValue(Integer.toString(0));            
        }
    }
}
