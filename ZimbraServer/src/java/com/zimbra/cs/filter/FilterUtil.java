/*
 * 
 */
package com.zimbra.cs.filter;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.mail.Address;
import javax.mail.Header;
import javax.mail.MessagingException;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

import org.apache.jsieve.mail.Action;

import com.google.common.collect.Sets;
import com.zimbra.common.localconfig.LC;
import com.zimbra.common.mime.MimeConstants;
import com.zimbra.common.mime.shim.JavaMailInternetAddress;
import com.zimbra.common.service.ServiceException;
import com.zimbra.common.soap.Element;
import com.zimbra.common.soap.MailConstants;
import com.zimbra.common.util.ArrayUtil;
import com.zimbra.common.util.CharsetUtil;
import com.zimbra.common.util.DateParser;
import com.zimbra.common.util.L10nUtil;
import com.zimbra.common.util.Pair;
import com.zimbra.common.util.StringUtil;
import com.zimbra.common.util.ZimbraLog;
import com.zimbra.common.zmime.ZInternetHeader;
import com.zimbra.cs.account.Account;
import com.zimbra.cs.account.AuthToken;
import com.zimbra.cs.account.Provisioning;
import com.zimbra.cs.account.Provisioning.AccountBy;
import com.zimbra.cs.filter.jsieve.ActionFlag;
import com.zimbra.cs.mailbox.DeliveryContext;
import com.zimbra.cs.mailbox.Folder;
import com.zimbra.cs.mailbox.MailItem;
import com.zimbra.cs.mailbox.MailSender;
import com.zimbra.cs.mailbox.Mailbox;
import com.zimbra.cs.mailbox.Message;
import com.zimbra.cs.mailbox.Mountpoint;
import com.zimbra.cs.mailbox.OperationContext;
import com.zimbra.cs.mailbox.Tag;
import com.zimbra.cs.mime.MPartInfo;
import com.zimbra.cs.mime.Mime;
import com.zimbra.cs.mime.ParsedMessage;
import com.zimbra.cs.service.AuthProvider;
import com.zimbra.cs.service.util.ItemId;
import com.zimbra.cs.util.AccountUtil;
import com.zimbra.cs.util.JMSession;
import com.zimbra.cs.zclient.ZFolder;
import com.zimbra.cs.zclient.ZMailbox;

public class FilterUtil {

    public static final DateParser SIEVE_DATE_PARSER = new DateParser("yyyyMMdd");

    public enum Condition {
        allof, anyof;

        public static Condition fromString(String value)
        throws ServiceException {
            if (value == null) {
                return null;
            }
            try {
                return Condition.valueOf(value);
            } catch (IllegalArgumentException e) {
                throw ServiceException.PARSE_ERROR(
                    "Invalid value: " + value + ", valid values: " + Arrays.asList(Condition.values()), e);
            }
        }

    }

    public enum Flag {
        read, flagged;

        public static Flag fromString(String value)
        throws ServiceException {
            if (value == null) {
                return null;
            }
            try {
                return Flag.valueOf(value);
            } catch (IllegalArgumentException e) {
                throw ServiceException.PARSE_ERROR(
                    "Invalid value: " + value + ", valid values: " + Arrays.asList(Flag.values()), e);
            }
        }
    }

    public enum StringComparison {
        is, contains, matches;

        public static StringComparison fromString(String value)
        throws ServiceException {
            if (value == null) {
                return null;
            }
            try {
                return StringComparison.valueOf(value);
            } catch (IllegalArgumentException e) {
                throw ServiceException.PARSE_ERROR(
                    "Invalid value: "+ value +", valid values: " + Arrays.asList(StringComparison.values()), e);
            }
        }
    }

    public enum Comparator {
        ioctet, iasciicasemap;

        private static String VALUE_STR_CASE_SENSITIVE = "i;octet";
        private static String VALUE_STR_CASE_INSENSITIVE = "i;ascii-casemap";

        public static Comparator fromString(String value)
        throws ServiceException {
            if (value == null)
                return null;
            if (VALUE_STR_CASE_SENSITIVE.equals(value))
                return ioctet;
            else if (VALUE_STR_CASE_INSENSITIVE.equals(value))
                return iasciicasemap;
            else
                throw ServiceException.PARSE_ERROR("Invalid Comparator value: " + value, null);
        }

        @Override
        public String toString() {
            return this == ioctet ? VALUE_STR_CASE_SENSITIVE : VALUE_STR_CASE_INSENSITIVE;
        }
    }

    public enum NumberComparison {
        over, under;

        public static NumberComparison fromString(String value)
        throws ServiceException {
            if (value == null) {
                return null;
            }
            try {
                return NumberComparison.valueOf(value);
            } catch (IllegalArgumentException e) {
                throw ServiceException.PARSE_ERROR(
                    "Invalid value: "+ value +", valid values: " + Arrays.asList(NumberComparison.values()), e);
            }
        }
    }

    public enum DateComparison {
        before, after;

        public static DateComparison fromString(String value)
        throws ServiceException {
            if (value == null) {
                return null;
            }
            try {
                return DateComparison.valueOf(value);
            } catch (IllegalArgumentException e) {
                throw ServiceException.PARSE_ERROR(
                    "Invalid value: "+ value +", valid values: " + Arrays.asList(StringComparison.values()), e);
            }
        }
    }

    /**
     * Returns a Sieve-escaped version of the given string.  Replaces <tt>\</tt> with
     * <tt>\\</tt> and <tt>&quot;</tt> with <tt>\&quot;</tt>.
     */
    public static String escape(String s) {
        if (s == null || s.length() == 0) {
            return s;
        }
        s = s.replace("\\", "\\\\");
        s = s.replace("\"", "\\\"");
        return s;
    }

    /**
     * Adds a value to the given <tt>Map</tt>.  If <tt>initialKey</tt> already
     * exists in the map, uses the next available index instead.  This way we
     * guarantee that we don't lose data if the client sends two elements with
     * the same index, or doesn't specify the index at all.
     *
     * @return the index used to insert the value
     */
    public static <T> int addToMap(Map<Integer, T> map, int initialKey, T value) {
        int i = initialKey;
        while (true) {
            if (!map.containsKey(i)) {
                map.put(i, value);
                return i;
            }
            i++;
        }
    }

    public static int getIndex(Element actionElement) {
        String s = actionElement.getAttribute(MailConstants.A_INDEX, "0");
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            ZimbraLog.soap.warn("Unable to parse index value %s for element %s.  Ignoring order.",
                s, actionElement.getName());
            return 0;
        }
    }

    /**
     * Parses a Sieve size string and returns the integer value.
     * The string may end with <tt>K</tt> (kilobytes), <tt>M</tt> (megabytes)
     * or <tt>G</tt> (gigabytes).  If the units are not specified, the
     * value is in bytes.
     *
     * @throws NumberFormatException if the value cannot be parsed
     */
    public static int parseSize(String sizeString) {
        if (sizeString == null || sizeString.length() == 0) {
            return 0;
        }
        sizeString = sizeString.toUpperCase();
        int multiplier = 1;
        if (sizeString.endsWith("K")) {
            sizeString = sizeString.substring(0, sizeString.length() - 1);
            multiplier = 1024;
        } else if (sizeString.endsWith("M")) {
            sizeString = sizeString.substring(0, sizeString.length() - 1);
            multiplier = 1024 * 1024;
        } else if (sizeString.endsWith("G")) {
            sizeString = sizeString.substring(0, sizeString.length() - 1);
            multiplier = 1024 * 1024 * 1024;
        }
        return Integer.parseInt(sizeString) * multiplier;
    }

    /**
     * Adds a message to the given folder.  Handles both local folders and mountpoints.
     * @return the id of the new message, or <tt>null</tt> if it was a duplicate
     */
    public static ItemId addMessage(DeliveryContext context, Mailbox mbox, ParsedMessage pm, String recipient,
                                    String folderPath, boolean noICal, int flags, String tags, int convId, OperationContext octxt)
    throws ServiceException {
        // Do initial lookup.
        Pair<Folder, String> folderAndPath = mbox.getFolderByPathLongestMatch(
            octxt, Mailbox.ID_FOLDER_USER_ROOT, folderPath);
        Folder folder = folderAndPath.getFirst();
        String remainingPath = folderAndPath.getSecond();
        ZimbraLog.filter.debug("Attempting to file to %s, remainingPath=%s.", folder, remainingPath);

        if (folder instanceof Mountpoint) {
            Mountpoint mountpoint = (Mountpoint) folder;
            ZMailbox remoteMbox = getRemoteZMailbox(mbox, mountpoint);

            // Look up remote folder.
            String remoteAccountId = mountpoint.getOwnerId();
            ItemId id = mountpoint.getTarget();
            ZFolder remoteFolder = remoteMbox.getFolderById(id.toString());
            if (remoteFolder != null) {
                if (remainingPath != null) {
                    remoteFolder = remoteFolder.getSubFolderByPath(remainingPath);
                    if (remoteFolder == null) {
                        String msg = String.format("Subfolder %s of mountpoint %s does not exist.",
                            remainingPath, mountpoint.getName());
                        throw ServiceException.FAILURE(msg, null);
                    }
                }
            }

            // File to remote folder.
            if (remoteFolder != null) {
                byte[] content;
                try {
                    content = pm.getRawData();
                } catch (Exception e) {
                    throw ServiceException.FAILURE("Unable to get message content", e);
                }
                String msgId = remoteMbox.addMessage(remoteFolder.getId(),
                    com.zimbra.cs.mailbox.Flag.bitmaskToFlags(flags),
                    null, 0, content, false);
                return new ItemId(msgId, remoteAccountId);
            } else {
                String msg = String.format("Unable to find remote folder %s for mountpoint %s.",
                    remainingPath, mountpoint.getName());
                throw ServiceException.FAILURE(msg, null);
            }
        } else {
            if (!StringUtil.isNullOrEmpty(remainingPath)) {
                // Only part of the folder path matched.  Auto-create the remaining path.
                ZimbraLog.filter.info("Could not find folder %s.  Automatically creating it.",
                    folderPath);
                folder = mbox.createFolder(octxt, folderPath, (byte) 0, MailItem.TYPE_MESSAGE);
            }
            try {
                Message msg = mbox.addMessage(octxt, pm, folder.getId(), noICal, flags, tags, convId, recipient, null, context);
                if (msg == null) {
                    return null;
                } else {
                    return new ItemId(msg);
                }
            } catch (IOException e) {
                throw ServiceException.FAILURE("Unable to add message", e);
            }
        }
    }

    /**
     * Returns a <tt>ZMailbox</tt> for the remote mailbox referenced by the given
     * <tt>Mountpoint</tt>.
     */
    public static ZMailbox getRemoteZMailbox(Mailbox localMbox, Mountpoint mountpoint)
    throws ServiceException {
        // Get auth token
        AuthToken authToken = null;
        OperationContext opCtxt = localMbox.getOperationContext();
        if (opCtxt != null) {
            authToken = opCtxt.getAuthToken();
        }
        if (authToken == null) {
            authToken = AuthProvider.getAuthToken(localMbox.getAccount());
        }

        // Get ZMailbox
        Account account = Provisioning.getInstance().get(AccountBy.id, mountpoint.getOwnerId());
        ZMailbox.Options zoptions = new ZMailbox.Options(authToken.toZAuthToken(), AccountUtil.getSoapUri(account));
        zoptions.setNoSession(true);
        zoptions.setTargetAccount(account.getId());
        zoptions.setTargetAccountBy(AccountBy.id);
        return ZMailbox.getMailbox(zoptions);
    }

    public static final String HEADER_FORWARDED = "X-Zimbra-Forwarded";

    public static void redirect(OperationContext octxt, Mailbox sourceMbox, MimeMessage msg, String destinationAddress)
    throws ServiceException {
        MimeMessage outgoingMsg;

        try {
            if (!isMailLoop(sourceMbox, msg)) {
                outgoingMsg = new Mime.FixedMimeMessage(msg);
                Mime.recursiveRepairTransferEncoding(outgoingMsg);
                outgoingMsg.setHeader(HEADER_FORWARDED, sourceMbox.getAccount().getName());
                outgoingMsg.saveChanges();
            } else {
                String error = String.format("Detected a mail loop for message %s.", Mime.getMessageID(msg));
                throw ServiceException.FAILURE(error, null);
            }
        } catch (MessagingException e) {
            try {
                outgoingMsg = createRedirectMsgOnError(msg);
                ZimbraLog.filter.info("Message format error detected.  Wrapper class in use.  %s", e.toString());
            } catch (MessagingException again) {
                throw ServiceException.FAILURE("Message format error detected.  Workaround failed.", again);
            }
        } catch (IOException e) {
            try {
                outgoingMsg = createRedirectMsgOnError(msg);
                ZimbraLog.filter.info("Message format error detected.  Wrapper class in use.  %s", e.toString());
            } catch (MessagingException me) {
                throw ServiceException.FAILURE("Message format error detected.  Workaround failed.", me);
            }
        }

        MailSender sender = sourceMbox.getMailSender().setSaveToSent(false).setSkipSendAsCheck(true);

        try {
            if (Provisioning.getInstance().getLocalServer().isMailRedirectSetEnvelopeSender()) {
                if (isDeliveryStatusNotification(msg) && LC.filter_null_env_sender_for_dsn_redirect.booleanValue()) {
                    sender.setEnvelopeFrom("<>");
                } else {
                    // Set envelope sender to the account name (bug 31309).
                    Account account = sourceMbox.getAccount();
                    sender.setEnvelopeFrom(account.getName());
                }
            } else {
                Address from = ArrayUtil.getFirstElement(outgoingMsg.getFrom());
                if (from != null) {
                    String address = ((InternetAddress) from).getAddress();
                    sender.setEnvelopeFrom(address);
                }
            }
            sender.setRecipients(destinationAddress);
            sender.sendMimeMessage(octxt, sourceMbox, outgoingMsg);
        } catch (MessagingException e) {
            ZimbraLog.filter.warn("Envelope sender will be set to the default value.", e);
        }
    }

    private static boolean isDeliveryStatusNotification(MimeMessage msg)
    throws MessagingException {
        String envelopeSender = msg.getHeader("Return-Path", null);
        String ct = Mime.getContentType(msg, "text/plain");
        ZimbraLog.filter.debug("isDeliveryStatusNotification(): Return-Path=%s, Auto-Submitted=%s, Content-Type=%s.",
            envelopeSender, msg.getHeader("Auto-Submitted", null), ct);

        if (StringUtil.isNullOrEmpty(envelopeSender) || envelopeSender.equals("<>")) {
            return true;
        }
        if (Mime.isAutoSubmitted(msg)) {
            return true;
        }
        if (ct.equals("multipart/report")) {
            return true;
        }
        return false;
    }

    public static void reply(OperationContext octxt, Mailbox mailbox, ParsedMessage parsedMessage, String bodyTemplate)
    throws MessagingException, ServiceException {
        MimeMessage mimeMessage = parsedMessage.getMimeMessage();
        if (isMailLoop(mailbox, mimeMessage)) {
            String error = String.format("Detected a mail loop for message %s.", Mime.getMessageID(mimeMessage));
            throw ServiceException.FAILURE(error, null);
        }
        if (isDeliveryStatusNotification(mimeMessage)) {
            ZimbraLog.filter.debug("Not auto-relying to a DSN message");
            return;
        }

        Account account = mailbox.getAccount();
        MimeMessage replyMsg = new Mime.FixedMimeMessage(JMSession.getSmtpSession(account));
        replyMsg.setHeader(HEADER_FORWARDED, account.getName());

        String to = mimeMessage.getHeader("Reply-To", null);
        if (StringUtil.isNullOrEmpty(to))
            to = Mime.getSender(mimeMessage);
        if (StringUtil.isNullOrEmpty(to))
            throw new MessagingException("Can't locate the address to reply to");
        replyMsg.setRecipient(javax.mail.Message.RecipientType.TO, new JavaMailInternetAddress(to));

        String subject = mimeMessage.getSubject();
        if (subject == null) {
            subject = "";
        }
        String replySubjectPrefix = L10nUtil.getMessage(L10nUtil.MsgKey.replySubjectPrefix, account.getLocale());
        if (!subject.toLowerCase().startsWith(replySubjectPrefix.toLowerCase())) {
            subject = replySubjectPrefix + " " + subject;
        }
        replyMsg.setSubject(subject, getCharset(account, subject));

        Map<String, String> vars = getVarsMap(mailbox, parsedMessage, mimeMessage);
        String body = StringUtil.fillTemplate(bodyTemplate, vars);
        replyMsg.setText(body, getCharset(account, body));

        String origMsgId = mimeMessage.getMessageID();
        if (!StringUtil.isNullOrEmpty(origMsgId))
            replyMsg.setHeader("In-Reply-To", origMsgId);
        replyMsg.setSentDate(new Date());
        replyMsg.saveChanges();

        MailSender mailSender = mailbox.getMailSender();
        mailSender.setReplyType(MailSender.MSGTYPE_REPLY);
        mailSender.sendMimeMessage(octxt, mailbox, replyMsg);
    }

    public static void notify(OperationContext octxt, Mailbox mailbox, ParsedMessage parsedMessage,
            String emailAddr, String subjectTemplate, String bodyTemplate, int maxBodyBytes, List<String> origHeaders)
    throws MessagingException, ServiceException {
        MimeMessage mimeMessage = parsedMessage.getMimeMessage();
        if (isMailLoop(mailbox, mimeMessage)) {
            String error = String.format("Detected a mail loop for message %s.", Mime.getMessageID(mimeMessage));
            throw ServiceException.FAILURE(error, null);
        }

        Account account = mailbox.getAccount();
        MimeMessage notification = new Mime.FixedMimeMessage(JMSession.getSmtpSession(account));
        notification.setHeader(HEADER_FORWARDED, account.getName());
        MailSender mailSender = mailbox.getMailSender().setSaveToSent(false);

        Map<String, String> vars = getVarsMap(mailbox, parsedMessage, mimeMessage);
        if (origHeaders == null || origHeaders.isEmpty()) {
            // no headers need to be copied from the original message
            notification.setRecipient(javax.mail.Message.RecipientType.TO, new JavaMailInternetAddress(emailAddr));
            notification.setSentDate(new Date());
            if (!StringUtil.isNullOrEmpty(subjectTemplate)) {
                String subject = StringUtil.fillTemplate(subjectTemplate, vars);
                notification.setSubject(subject, getCharset(account, subject));
            }
        } else {
            if (origHeaders.size() == 1 && "*".equals(origHeaders.get(0))) {
                // all headers need to be copied from the original message
                Enumeration enumeration = mimeMessage.getAllHeaders();
                while (enumeration.hasMoreElements()) {
                    Header header = (Header) enumeration.nextElement();
                    notification.addHeader(header.getName(), header.getValue());
                }
            } else {
                // some headers need to be copied from the original message
                Set<String> headersToCopy = Sets.newHashSet(origHeaders);
                boolean copySubject = false;
                for (String header : headersToCopy) {
                    if ("Subject".equalsIgnoreCase(header)) {
                        copySubject = true;
                    }
                    String[] hdrVals = mimeMessage.getHeader(header);
                    if (hdrVals == null) {
                        continue;
                    }
                    for (String hdrVal : hdrVals) {
                        notification.addHeader(header, hdrVal);
                    }
                }
                if (!copySubject && !StringUtil.isNullOrEmpty(subjectTemplate)) {
                    String subject = StringUtil.fillTemplate(subjectTemplate, vars);
                    notification.setSubject(subject, getCharset(account, subject));
                }
            }
            mailSender.setSkipSendAsCheck(true);
            mailSender.setRecipients(emailAddr);
        }

        String body = StringUtil.fillTemplate(bodyTemplate, vars);
        body = truncateBodyIfRequired(body, maxBodyBytes);
        notification.setText(body, getCharset(account, body));
        notification.saveChanges();

        if (isDeliveryStatusNotification(mimeMessage)) {
            mailSender.setEnvelopeFrom("<>");
        } else {
            mailSender.setEnvelopeFrom(account.getName());
        }
        mailSender.sendMimeMessage(octxt, mailbox, notification);
    }

    /**
     * Gets appropriate charset for the given data. The charset preference order is:
     *                `
     * 1. "us-ascii"
     * 2. Account's zimbraPrefMailDefaultCharset attr
     * 3. "utf-8"
     *
     * @param account
     * @param data
     * @return
     */
    private static String getCharset(Account account, String data) {
        if (MimeConstants.P_CHARSET_ASCII.equals(CharsetUtil.checkCharset(data, MimeConstants.P_CHARSET_ASCII))) {
            return MimeConstants.P_CHARSET_ASCII;
        } else {
            return CharsetUtil.checkCharset(data, account.getAttr(Provisioning.A_zimbraPrefMailDefaultCharset, MimeConstants.P_CHARSET_UTF8));
        }
    }

    static String truncateBodyIfRequired(String body, int maxBodyBytes) {
        try {
            byte[] bodyBytes = body.getBytes(MimeConstants.P_CHARSET_UTF8);
            if (maxBodyBytes > -1 && bodyBytes.length > maxBodyBytes) {
                // During truncation make sure that we don't end up with a partial char at the end of the body.
                // Start from index maxBodyBytes and going backwards determine the first byte that is a starting
                // byte for a character. Such a byte is one whose top bit is 0 or whose top 2 bits are 11.
                int indexToExclude = maxBodyBytes;
                while (indexToExclude > 0 && bodyBytes[indexToExclude] < -64) {
                    indexToExclude--;
                }
                return new String(bodyBytes, 0, indexToExclude, MimeConstants.P_CHARSET_UTF8);
            }
        } catch (UnsupportedEncodingException e) {
            ZimbraLog.filter.error("Error while truncating body", e);
        }
        return body;
    }

    private static Map<String, String> getVarsMap(Mailbox mailbox, ParsedMessage parsedMessage, MimeMessage mimeMessage)
            throws MessagingException, ServiceException {
        Map<String, String> vars = new HashMap<String, String>() {
            @Override
            public String get(Object key) {
                return super.get(((String) key).toLowerCase());
            }
        };
        Enumeration enumeration = mimeMessage.getAllHeaders();
        while (enumeration.hasMoreElements()) {
            Header header = (Header) enumeration.nextElement();
            vars.put(header.getName().toLowerCase(),
                    ZInternetHeader.decode(mimeMessage.getHeader(header.getName(), ",")));
        }
        // raw subject could be encoded, so get the parsed subject
        vars.put("subject", parsedMessage.getSubject());
        MPartInfo bodyPart = Mime.getTextBody(parsedMessage.getMessageParts(), false);
        try {
            vars.put("body",
                     Mime.getStringContent(bodyPart.getMimePart(), mailbox.getAccount().getPrefMailDefaultCharset()));
        } catch (IOException e) {
            ZimbraLog.filter.warn("Error in reading text body", e);
        }
        return vars;
    }

    private static MimeMessage createRedirectMsgOnError(final MimeMessage originalMsg) throws MessagingException {
        // If MimeMessage.saveChanges fails, create a copy of the message
        // that doesn't recursively call updateHeaders() upon saveChanges().
        // This uses double the memory on malformed messages, but it should
        // avoid having a deep-buried misparse throw off the whole forward.
        // TODO: With JavaMail 1.4.3, this workaround might not be needed any more.
        return new Mime.FixedMimeMessage(originalMsg) {
            @Override
            protected void updateHeaders() throws MessagingException {
                setHeader("MIME-Version", "1.0");
                updateMessageID();
            }
        };
    }

    /**
     * Returns <tt>true</tt> if the current account's name is
     * specified in one of the X-Zimbra-Forwarded headers.
     */
    private static boolean isMailLoop(Mailbox sourceMbox, MimeMessage msg)
    throws ServiceException {
        String[] forwards = Mime.getHeaders(msg, HEADER_FORWARDED);
        String userName = sourceMbox.getAccount().getName();
        for (String forward : forwards) {
            if (StringUtil.equal(userName, forward)) {
                return true;
            }
        }
        return false;
    }

    public static int getFlagBitmask(Collection<ActionFlag> flagActions, int startingBitMask, Mailbox mailbox) {
        int flagBits = startingBitMask;
        for (Action action : flagActions) {
            ActionFlag flagAction = (ActionFlag) action;
            int flagId = flagAction.getFlagId();
            try {
                com.zimbra.cs.mailbox.Flag flag = mailbox.getFlagById(flagId);
                if (flagAction.isSetFlag())
                    flagBits |= flag.getBitmask();
                else
                    flagBits &= (~flag.getBitmask());
            } catch (ServiceException e) {
                ZimbraLog.filter.warn("Unable to flag message", e);
            }
        }
        return flagBits;
    }

    public static String getTagsUnion(String tags1, String tags2) {
        return Tag.bitmaskToTags(Tag.tagsToBitmask(tags1) | Tag.tagsToBitmask(tags2));
    }
}

