/*
 * 
 */
package org.jivesoftware.wildfire.user;

import org.dom4j.Element;
import org.jivesoftware.stringprep.Stringprep;
import org.jivesoftware.stringprep.StringprepException;
import org.jivesoftware.util.*;
import org.jivesoftware.wildfire.IQResultListener;
import org.jivesoftware.wildfire.XMPPServer;
import org.jivesoftware.wildfire.event.UserEventDispatcher;
import org.xmpp.packet.IQ;
import org.xmpp.packet.JID;

import java.util.Collection;
import java.util.Collections;
import java.util.Iterator;
import java.util.Set;

/**
 * Manages users, including loading, creating and deleting.
 *
 * @author Matt Tucker
 * @see User
 */
public class UserManager implements IQResultListener {

    /**
     * Cache of local users.
     */
    private static Cache<String, User> userCache;
    /**
     * Cache if a local or remote user exists.
     */
    private static Cache<String, Boolean> remoteUsersCache;
    private static UserProvider provider;
    private static UserManager instance = new UserManager();

    static {
        // Initialize caches.
        userCache = CacheManager.initializeCache("User", "userCache", 512 * 1024,
                JiveConstants.MINUTE*30);
        remoteUsersCache = CacheManager.initializeCache("Remote Users Existence", "remoteUsersCache",
                512 * 1024, JiveConstants.MINUTE*30);
        CacheManager.initializeCache("Roster", "username2roster", 512 * 1024);
        // Load a user provider.
        String className = IMConfig.USER_PROVIDER_CLASSNAME.getString();
        try {
            Class c = ClassUtils.forName(className);
            provider = (UserProvider)c.newInstance();
        }
        catch (Exception e) {
            Log.error("Error loading user provider: " + className, e);
        }
    }

    /**
     * Returns the currently-installed UserProvider. <b>Warning:</b> in virtually all
     * cases the user provider should not be used directly. Instead, the appropriate
     * methods in UserManager should be called. Direct access to the user provider is
     * only provided for special-case logic.
     *
     * @return the current UserProvider.
     */
    public static UserProvider getUserProvider() {
        return provider;
    }

    /**
     * Returns a singleton UserManager instance.
     *
     * @return a UserManager instance.
     */
    public static UserManager getInstance() {
        return instance;
    }

    private UserManager() {

    }

    /**
     * Creates a new User. Required values are username and password. The email address
     * can optionally be <tt>null</tt>.
     *
     * @param username the new and unique username for the account.
     * @param password the password for the account (plain text).
     * @param email the email address to associate with the new account, which can
     *      be <tt>null</tt>.
     * @return a new User.
     * @throws UserAlreadyExistsException if the username already exists in the system.
     * @throws UnsupportedOperationException if the provider does not support the
     *      operation.
     */
    public User createUser(String username, String password, String name, String email)
            throws UserAlreadyExistsException
    {
        if (username.indexOf('@')<=0) {
            throw new IllegalArgumentException("Invalid username (must contain @ sign): "+username);
        }
        if (provider.isReadOnly()) {
            throw new UnsupportedOperationException("User provider is read-only.");
        }
        // Make sure that the username is valid.
        try {
            username = Stringprep.nodeprep(username);
        }
        catch (StringprepException se) {
            throw new IllegalArgumentException("Invalid username: " + username,  se);
        }
        User user = provider.createUser(username, password, name, email);
        userCache.put(username, user);

        // Fire event.
        UserEventDispatcher.dispatchEvent(user, UserEventDispatcher.EventType.user_created,
                Collections.emptyMap());

        return user;
    }

    /**
     * Deletes a user (optional operation).
     *
     * @param user the user to delete.
     */
    public void deleteUser(User user) {
        if (provider.isReadOnly()) {
            throw new UnsupportedOperationException("User provider is read-only.");
        }

        String username = user.getUsername();
        assert(username.indexOf('@')>0);
        
        // Make sure that the username is valid.
        try {
            username = Stringprep.nodeprep(username);
        }
        catch (StringprepException se) {
            throw new IllegalArgumentException("Invalid username: " + username,  se);
        }

        // Fire event.
        UserEventDispatcher.dispatchEvent(user, UserEventDispatcher.EventType.user_deleting,
                Collections.emptyMap());

        provider.deleteUser(user.getUsername());
        // Remove the user from cache.
        userCache.remove(user.getUsername());
    }
    
    public void deleteUser(String username) {
        username = username.trim().toLowerCase();
        User user = userCache.get(username);
        
        if (provider.isReadOnly()) {
            throw new UnsupportedOperationException("User provider is read-only.");
        }

        assert(username.indexOf('@')>0);
        
        // Make sure that the username is valid.
        try {
            username = Stringprep.nodeprep(username);
        }
        catch (StringprepException se) {
            throw new IllegalArgumentException("Invalid username: " + username,  se);
        }

        if (user != null) {
            // Fire event.
            UserEventDispatcher.dispatchEvent(user, UserEventDispatcher.EventType.user_deleting,
                                              Collections.emptyMap());
        }
            
        provider.deleteUser(username);
        // Remove the user from cache.
        userCache.remove(username);
    }
    

    /**
     * Returns the User specified by username.
     *
     * @param username the username of the user.
     * @return the User that matches <tt>username</tt>.
     * @throws UserNotFoundException if the user does not exist.
     */
    public User getUser(String username) throws UserNotFoundException {
        return getUser(username, false);
    }
    
    /**
     * Returns the User specified by username.
     *
     * @param username the username of the user.
     * @param ignoreServerCheck if TRUE then don't enfore the check to see if this user is local to this server.  
     *        Used when we're deleting/migrating users between servers
     * @return the User that matches <tt>username</tt>.
     * @throws UserNotFoundException if the user does not exist.
     */
    public User getUser(String username, boolean ignoreServerCheck) throws UserNotFoundException {
        if (username == null) {
            throw new UserNotFoundException("Username cannot be null");
        }
        // Make sure that the username is valid.
        username = username.trim().toLowerCase();
        User user = userCache.get(username);
        if (user == null) {
            synchronized (username.intern()) {
                user = userCache.get(username);
                if (user == null) {
                    user = provider.loadUser(username, ignoreServerCheck);
                    userCache.put(username, user);
                }
            }
        }
        return user;
    }

    /**
     * Returns the total number of users in the system.
     *
     * @return the total number of users.
     */
    public int getUserCount() {
        return provider.getUserCount();
    }

    /**
     * Returns an unmodifiable Collection of all users in the system.
     *
     * @return an unmodifiable Collection of all users.
     */
    public Collection<User> getUsers() {
        return provider.getUsers();
    }

    /**
     * Returns an unmodifiable Collection of usernames of all users in the system.
     *
     * @return an unmodifiable Collection of all usernames in the system.
     */
    public Collection<String> getUsernames() {
        return provider.getUsernames();
    }

    /**
     * Returns an unmodifiable Collection of all users starting at <tt>startIndex</tt>
     * with the given number of results. This is useful to support pagination in a GUI
     * where you may only want to display a certain number of results per page. It is
     * possible that the number of results returned will be less than that specified
     * by <tt>numResults</tt> if <tt>numResults</tt> is greater than the number of
     * records left to display.
     *
     * @param startIndex the beginning index to start the results at.
     * @param numResults the total number of results to return.
     * @return a Collection of users in the specified range.
     */
    public Collection<User> getUsers(int startIndex, int numResults) {
        return provider.getUsers(startIndex, numResults);
    }

    /**
     * Returns the set of fields that can be used for searching for users. Each field
     * returned must support wild-card and keyword searching. For example, an
     * implementation might send back the set {"Username", "Name", "Email"}. Any of
     * those three fields can then be used in a search with the
     * {@link #findUsers(Set,String)} method.<p>
     *
     * This method should throw an UnsupportedOperationException if this
     * operation is not supported by the backend user store.
     *
     * @return the valid search fields.
     * @throws UnsupportedOperationException if the provider does not
     *      support the operation (this is an optional operation).
     */
    public Set<String> getSearchFields() throws UnsupportedOperationException {
        return provider.getSearchFields();
    }

    /**
     * Searches for users based on a set of fields and a query string. The fields must
     * be taken from the values returned by {@link #getSearchFields()}. The query can
     * include wildcards. For example, a search on the field "Name" with a query of "Ma*"
     * might return user's with the name "Matt", "Martha" and "Madeline".<p>
     *
     * This method throws an UnsupportedOperationException if this operation is
     * not supported by the user provider.
     *
     * @param fields the fields to search on.
     * @param query the query string.
     * @return a Collection of users that match the search.
     * @throws UnsupportedOperationException if the provider does not
     *      support the operation (this is an optional operation).
     */
    public Collection<User> findUsers(Set<String> fields, String query)
            throws UnsupportedOperationException
    {
        return provider.findUsers(fields, query);
    }

    /**
     * Returns the value of the specified property for the given username. If the user
     * has been loaded into memory then the ask the user to return the value of the
     * property. However, if the user is not present in memory then try to get the property
     * value directly from the database as a way to optimize the performance.
     *
     * @param username the username of the user to get a specific property value.
     * @param propertyName the name of the property to return its value.
     * @return the value of the specified property for the given username.
     */
    public String getUserProperty(String username, String propertyName) {
        assert(username.indexOf('@')>0);
        username = username.trim().toLowerCase();
        User user = userCache.get(username);
        if (user == null) {
            return User.getPropertyValue(username, propertyName);
        }
        else {
            // User is in memory so ask the user for the specified property value
            return user.getProperties().get(propertyName);
        }
    }

    /**
     * Returns true if the specified local username belongs to a registered local user.
     *
     * @param username to username of the user to check it it's a registered user.
     * @return true if the specified JID belongs to a local registered user.
     */
    public boolean isRegisteredUser(String username) {
        if (username == null || "".equals(username)) {
            return false;
        }
        try {
            getUser(username);
            return true;
        }
        catch (UserNotFoundException e) {
            return false;
        }
    }

    /**
     * Returns true if the specified JID belongs to a local or remote registered user. For
     * remote users (i.e. domain does not match local domain) a disco#info request is going
     * to be sent to the bare JID of the user.
     *
     * @param user to JID of the user to check it it's a registered user.
     * @return true if the specified JID belongs to a local or remote registered user.
     */
    public boolean isRegisteredUser(JID user) {
        XMPPServer server = XMPPServer.getInstance();
        if (server.isLocal(user)) {
            try {
                getUser(user.toBareJID());
                return true;
            }
            catch (UserNotFoundException e) {
                return false;
            }
        }
        else {
            // Look up in the cache using the full JID
            Boolean isRegistered = remoteUsersCache.get(user.toString());
            if (isRegistered == null) {
                // Check if the bare JID of the user is cached
                isRegistered = remoteUsersCache.get(user.toBareJID());
                if (isRegistered == null) {
                    // No information is cached so check user identity and cache it
                    // A disco#info is going to be sent to the bare JID of the user. This packet
                    // is going to be handled by the remote server.
                    IQ iq = new IQ(IQ.Type.get);
                    iq.setFrom(server.getServerInfo().getDefaultName());
                    iq.setTo(user.toBareJID());
                    iq.setChildElement("query", "http://jabber.org/protocol/disco#info");
                    // Send the disco#info request to the remote server. The reply will be
                    // processed by the IQResultListener (interface that this class implements)
                    server.getIQRouter().addIQResultListener(iq.getID(), this);
                    synchronized (user.toBareJID().intern()) {
                        server.getIQRouter().route(iq);
                        // Wait for the reply to be processed. Time out in 10 minutes.
                        try {
                            user.toBareJID().intern().wait(600000);
                        }
                        catch (InterruptedException e) {
                            // Do nothing
                        }
                    }
                    // Get the discovered result
                    isRegistered = remoteUsersCache.get(user.toBareJID());
                    if (isRegistered == null) {
                        // Disco failed for some reason (i.e. we timed out before getting a result)
                        // so assume that user is not anonymous and cache result
                        isRegistered = Boolean.FALSE;
                        remoteUsersCache.put(user.toString(), isRegistered);
                    }
                }
            }
            return isRegistered;
        }
    }

    public void receivedAnswer(IQ packet) {
        JID from = packet.getFrom();
        // Assume that the user is not a registered user
        Boolean isRegistered = Boolean.FALSE;
        // Analyze the disco result packet
        if (IQ.Type.result == packet.getType()) {
            Element child = packet.getChildElement();
            for (Iterator it=child.elementIterator("identity"); it.hasNext();) {
                Element identity = (Element) it.next();
                String accountType = identity.attributeValue("type");
                if ("registered".equals(accountType) || "admin".equals(accountType)) {
                    isRegistered = Boolean.TRUE;
                    break;
                }
            }
        }
        // Update cache of remote registered users
        remoteUsersCache.put(from.toBareJID(), isRegistered);

        // Wake up waiting thread
        synchronized (from.toBareJID().intern()) {
            from.toBareJID().intern().notifyAll();
        }
    }
}