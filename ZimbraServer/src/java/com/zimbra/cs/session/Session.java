/*
 * 
 */

package com.zimbra.cs.session;

import java.text.SimpleDateFormat;
import java.util.Date;

import com.zimbra.common.localconfig.LC;
import com.zimbra.common.service.ServiceException;
import com.zimbra.common.soap.Element;
import com.zimbra.common.util.StringUtil;
import com.zimbra.cs.account.Account;
import com.zimbra.cs.im.IMNotification;
import com.zimbra.cs.im.IMPersona;
import com.zimbra.cs.mailbox.Mailbox;
import com.zimbra.cs.mailbox.MailboxManager;

/**
 *  A {@link Session} is identified by an (accountId, sessionID) pair.  A single
 *  account may have multiple active sessions simultaneously.<p>
 *
 *  In general, Sessions are created and managed by the {@link SessionCache} but
 *  this is not always the case.  Session subclasses  which are not stored in the
 *  SessionCache must take special care to manage their own lifetimes (timeouts,
 *  etc)
 */
public abstract class Session {
    protected final String mAuthenticatedAccountId;
    protected final String mTargetAccountId;
    private   final Type   mSessionType;

    private   String    mSessionId;
    protected volatile Mailbox mMailbox;
    private   IMPersona mPersona;
    private   long      mLastAccessed;
    private   long      mCreationTime;
    private   boolean   mCleanedUp;
    private   boolean   mIsRegistered;
    private   boolean   mAddedToCache;


    /**
     * Session Type
     */
    public enum Type {
        NULL(0, 0), // unused dummy session type
        SOAP(1, LC.zimbra_session_limit_soap.intValue()),
        IMAP(2, Math.max(0, LC.zimbra_session_limit_imap.intValue())),
        ADMIN(3, 5),
        WIKI(4, 0),
        SYNCLISTENER(5, LC.zimbra_session_limit_sync.intValue()),
        WAITSET(6, 0)
        ;

        Type(int index, int maxPerAccount) {
            mIndex = index;
            mMaxPerAccount = maxPerAccount;
        }

        private final int mIndex;
        private final int mMaxPerAccount;

        public final int getIndex() {
            return mIndex;
        }

        public final int getMaxPerAccount() {
            return mMaxPerAccount;
        }
    }

    /** Creates a {@code Session} of the given <tt>Type</tt> whose target
     *  {@link Account} is the same as its authenticated <tt>Account</tt>.
     * @param accountId  The account ID of the {@code Session}'s owner
     * @param type       The type of {@code Session} being created */
    public Session(String accountId, Type type) {
        this(accountId, accountId, type);
    }

    /** Creates a {@code Session} of the given <tt>Type</tt> with its owner
     *  and target specified separately.  In general, a {@code Session}
     *  should only be created on the server where the target mailbox lives.
     *
     * @param authId    The account ID of the {@code Session}'s owner
     * @param targetId  The account ID of the {@link Mailbox} the
     *                  {@code Session} is attached to
     * @param type      The type of {@code Session} being created */
    public Session(String authId, String targetId, Type type) {
        mAuthenticatedAccountId = authId;
        mTargetAccountId = targetId == null ? authId : targetId;
        mSessionType = type;
        mCreationTime = System.currentTimeMillis();
        mLastAccessed = mCreationTime;
        mSessionId = SessionCache.getNextSessionId(mSessionType);
    }

    public Type getType() {
        return mSessionType;
    }

    /** Registers this session as an IM listener
     * @throws ServiceException */
    public synchronized void registerWithIM(IMPersona persona) throws ServiceException {
        assert(Thread.holdsLock(persona.getLock()));
        assert(mPersona == null || mPersona == persona);

        if (mPersona == null && isIMListener() && !isDelegatedSession()) {
            mPersona = persona;
            mPersona.addListener(this);
        }
    }

    /** Registers the session as a listener on the target mailbox and adds
     *  it to the session cache.  When a session is added to the cache, its
     *  session ID is initialized.
     *
     * @see #isMailboxListener()
     * @see #isRegisteredInCache() */
    public Session register() throws ServiceException {
        if (mIsRegistered) {
            return this;
        }

        if (isMailboxListener()) {
            Mailbox mbox = mMailbox = MailboxManager.getInstance().getMailboxByAccountId(mTargetAccountId);

            // once addListener is called, you may NOT lock the mailbox (b/c of deadlock possibilities)
            if (mbox != null) {
                mbox.addListener(this);
            }
        }

        // registering the session automatically sets mSessionId
        if (isRegisteredInCache()) {
            addToSessionCache();
        }

        mIsRegistered = true;

        return this;
    }

    /** Unregisters the session as a listener on the target mailbox and removes
     *  it from the session cache.  When a session is removed from the cache,
     *  its session ID is nulled out.
     *
     * @see #isMailboxListener()
     * @see #isRegisteredInCache() */
    public Session unregister() {
        // locking order is always Mailbox then Session
        Mailbox mbox = mMailbox;
        assert(mbox == null || Thread.holdsLock(mbox) || !Thread.holdsLock(this));

        // Must do this in two steps (first, w/ the Session lock, and then
        // w/ the Persona lock if we have one) b/c of possible deadlock.
        IMPersona persona = null;
        synchronized (this) {
            persona = mPersona;
            mPersona = null;
        }
        if (persona != null) {
            persona.removeListener(this);
        }

        if (mbox != null && isMailboxListener()) {
            mbox.removeListener(this);
            mMailbox = null;
        }

        removeFromSessionCache();

        mIsRegistered = false;

        return this;
    }

    protected boolean isRegistered() {
        return mIsRegistered;
    }

    /** Returns TRUE if this session wants to hear about IM events. */
    protected boolean isIMListener() {
        return false;
    }

    /** Whether the session should be attached to the target {@link Mailbox}
     *  when its {@link #register()} method is invoked. */
    abstract protected boolean isMailboxListener();

    /** Whether the session should be added to the {@link SessionCache} when
     *  its {@link #register()} method is invoked.  A session ID is assigned
     *  when a session is added to the cache. */
    abstract protected boolean isRegisteredInCache();

    public static final int OPERATION_HISTORY_LENGTH = 6;
    public static final int OPERATION_HISTORY_TIME = 10 * 1000;

    public final void encodeState(Element parent) {
        doEncodeState(parent);
    }

    protected void doEncodeState(Element parent) {}

    protected void addToSessionCache() {
        SessionCache.registerSession(this);
        mAddedToCache = true;
    }

    protected void removeFromSessionCache() {
        if (mAddedToCache) {
            SessionCache.unregisterSession(this);
            mAddedToCache = false;
        }
    }

    /** Returns whether this session has been added to the cache. */
    public boolean isAddedToSessionCache() {
        return mAddedToCache;
    }

    /** Returns the Session's identifier. */
    public String getSessionId() {
        return mSessionId;
    }

    /** Returns the Session's identifier, qualified uniquely by the server run. */
    public String getQualifiedSessionId() {
        return SessionCache.qualifySessionId(mSessionId);
    }

    /** Sets the Session's identifier. Used for unit testing only,
     * DO NOT CALL THIS API EXCEPT FOR TEST PURPOSES */
    final Session testSetSessionId(String sessionId) {
        mSessionId = sessionId;
        return this;
    }

    /** Returns the type of the Session.
     * @see Type */
    public Session.Type getSessionType() {
        return mSessionType;
    }

    /** Returns the maximum idle duration (in milliseconds) for the Session.
     *  The idle lifetime must be CONSTANT  */
    protected abstract long getSessionIdleLifetime();

    /** Returns the {@link Mailbox} (if any) this Session is listening on. */
    public Mailbox getMailbox() {
        return mMailbox;
    }

    /** Handles the set of changes from a single Mailbox transaction.
     *  <p>
     *  Takes a set of new mailbox changes and caches it locally.  This is
     *  currently initiated from inside the Mailbox transaction commit, but we
     *  still shouldn't assume that execution of this method is synchronized
     *  on the Mailbox.
     *  <p>
     *  *All* changes are currently cached, regardless of the client's state/views.
     * @param pns       A set of new change notifications from our Mailbox.
     * @param changeId  The change ID of the change.
     * @param source    The {@code Session} originating these changes, or
     *                  <tt>null</tt> if none was specified. */
    public abstract void notifyPendingChanges(PendingModifications pns, int changeId, Session source);

    /** Notify this session that an IM event has occured. */
    public void notifyIM(IMNotification imn) {
        // do nothing by default.
    }

    /** Disconnects from any resources and deregisters as a {@link Mailbox}
     *  listener. */
    final void doCleanup() {
        if (mCleanedUp) {
            return;
        }

        try {
            cleanup();
            unregister();
        } finally {
            mCleanedUp = true;
        }
        mMailbox = null;
    }

    abstract protected void cleanup();

    public long getLastAccessTime() {
        return mLastAccessed;
    }

    public long getCreationTime() {
        return mCreationTime;
    }

    /** Public API for updating the access time of a session. */
    public void updateAccessTime() {
        // go through the session cache so that the session cache's
        // time-ordered access list stays correct
        // see bug 16242
        SessionCache.lookup(mSessionId, mAuthenticatedAccountId);
    }

    /**
     * This API must only be called by the SessionCache,
     * all other callers should use updateAccessTime()
     */
    void sessionCacheSetLastAccessTime() {
        mLastAccessed = System.currentTimeMillis();
    }

    public boolean accessedAfter(long otherTime) {
        return mLastAccessed > otherTime;
    }

    /** Returns the account ID of the {@code Session}'s owner.
     * @see #getTargetAccountId() */
    public String getAuthenticatedAccountId() {
        return mAuthenticatedAccountId;
    }

    /** Returns the account ID of the {@link Mailbox} that the {@code Session}
     *  is attached to.
     * @see #getAuthenticatedAccountId() */
    public String getTargetAccountId() {
        return mTargetAccountId;
    }

    public boolean isDelegatedSession() {
        return !mAuthenticatedAccountId.equalsIgnoreCase(mTargetAccountId);
    }

    @Override public String toString() {
        String dateString = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss,SSS").format(new Date(mLastAccessed));
        return StringUtil.getSimpleClassName(this) + ": {sessionId: " + mSessionId + ", accountId: " + mAuthenticatedAccountId + ", lastAccessed: " + dateString + "}";
    }
}
