/*
 * 
 */
package org.jivesoftware.wildfire.event;

import org.jivesoftware.wildfire.group.Group;

import java.util.Map;

/**
 * Interface to listen for group events. Use the
 * {@link GroupEventDispatcher#addListener(GroupEventListener)}
 * method to register for events.
 *
 * @author Matt Tucker
 */
public interface GroupEventListener {

    /**
     * A group was created.
     *
     * @param group the group.
     * @param params event parameters.
     */
    public void groupCreated(Group group, Map params);

    /**
     * A group is being deleted.
     *
     * @param group the group.
     * @param params event parameters.
     */
    public void groupDeleting(Group group, Map params);

    /**
     * A group's name, description, or an extended property was changed.
     *
     * @param group the group.
     * @param params event parameters.
     */
    public void groupModified(Group group, Map params);

    /**
     * A member was added to a group.
     *
     * @param group the group.
     * @param params event parameters.
     */
    public void memberAdded(Group group, Map params);

    /**
     * A member was removed from a group.
     *
     * @param group the group.
     * @param params event parameters.
     */
    public void memberRemoved(Group group, Map params);

    /**
     * An administrator was added to a group.
     *
     * @param group the group.
     * @param params event parameters.
     */
    public void adminAdded(Group group, Map params);

    /**
     * An administrator was removed from a group.
     *
     * @param group the group.
     * @param params event parameters.
     */
    public void adminRemoved(Group group, Map params);
}