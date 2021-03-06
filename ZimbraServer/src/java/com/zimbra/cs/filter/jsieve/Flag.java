/*
 * 
 */

/*
 * Created on Nov 8, 2004
 *
 */
package com.zimbra.cs.filter.jsieve;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.jsieve.Argument;
import org.apache.jsieve.Arguments;
import org.apache.jsieve.Block;
import org.apache.jsieve.SieveContext;
import org.apache.jsieve.exception.SieveException;
import org.apache.jsieve.StringListArgument;
import org.apache.jsieve.exception.SyntaxException;
import org.apache.jsieve.commands.AbstractActionCommand;
import org.apache.jsieve.mail.MailAdapter;

public class Flag extends AbstractActionCommand {

    private static Map<String, ActionFlag> FLAGS = new HashMap<String, ActionFlag>();
    
    static {
        FLAGS.put("read", new ActionFlag(com.zimbra.cs.mailbox.Flag.ID_FLAG_UNREAD, false, "read"));
        FLAGS.put("unread", new ActionFlag(com.zimbra.cs.mailbox.Flag.ID_FLAG_UNREAD, true, "unread"));
        FLAGS.put("flagged", new ActionFlag(com.zimbra.cs.mailbox.Flag.ID_FLAG_FLAGGED, true, "flagged"));
        FLAGS.put("unflagged", new ActionFlag(com.zimbra.cs.mailbox.Flag.ID_FLAG_FLAGGED, false, "unflagged"));
    }

    @Override
    protected Object executeBasic(MailAdapter mail, Arguments args, Block arg2, SieveContext context) {
        String flagName =
            (String) ((StringListArgument) args.getArgumentList().get(0))
                .getList().get(0);
        ActionFlag action = FLAGS.get(flagName);
        mail.addAction(action);

        return null;
    }

    @Override
    protected void validateArguments(Arguments arguments, SieveContext context)
    throws SieveException {
        @SuppressWarnings("unchecked")
        List<Argument> args = arguments.getArgumentList();
        if (args.size() != 1)
            throw new SyntaxException(
                "Exactly 1 argument permitted. Found " + args.size());

        Object argument = args.get(0);
        if (!(argument instanceof StringListArgument))
            throw new SyntaxException("Expecting a string-list");

        @SuppressWarnings("unchecked")
        List<String> strList = ((StringListArgument) argument).getList();
        if (1 != strList.size())
            throw new SyntaxException("Expecting exactly one argument");
        String flagName = strList.get(0);
        if (! FLAGS.containsKey(flagName.toLowerCase()))
            throw new SyntaxException("Invalid flag: " + flagName);
    }
}
