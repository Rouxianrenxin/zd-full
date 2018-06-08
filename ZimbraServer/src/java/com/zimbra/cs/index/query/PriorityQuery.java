/*
 * 
 */
package com.zimbra.cs.index.query;

import com.google.common.base.Preconditions;
import com.zimbra.common.service.ServiceException;
import com.zimbra.cs.mailbox.Mailbox;

/**
 * Query messages by priority.
 * <p>
 * <ul>
 *  <li>High priority messages are tagged with {@code \Urgent}.
 *  <li>Low priority messages are tagged with {@code \Bulk}.
 * </ul>
 *
 * @author ysasaki
 */
public final class PriorityQuery extends TagQuery {

    public enum Priority {
        HIGH("\\Urgent"), LOW("\\Bulk");

        private final String flag;

        private Priority(String flag) {
            this.flag = flag;
        }

        private String toFlag() {
            return flag;
        }
    }

    private final Priority priority;

    public PriorityQuery(Mailbox mailbox, Priority priority) throws ServiceException {
        super(mailbox, Preconditions.checkNotNull(priority).toFlag(), true);
        this.priority = priority;
    }

    @Override
    public void dump(StringBuilder out) {
        out.append("Priority,");
        out.append(priority.name());
    }

}