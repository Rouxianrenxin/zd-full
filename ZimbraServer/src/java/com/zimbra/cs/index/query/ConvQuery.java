/*
 * 
 */
package com.zimbra.cs.index.query;

import java.util.ArrayList;
import java.util.List;

import com.zimbra.common.service.ServiceException;
import com.zimbra.cs.index.DBQueryOperation;
import com.zimbra.cs.index.QueryOperation;
import com.zimbra.cs.mailbox.Mailbox;
import com.zimbra.cs.service.util.ItemId;

/**
 * Query by conversation ID.
 *
 * @author tim
 * @author ysasaki
 */
public final class ConvQuery extends Query {
    private ItemId mConvId;
    private Mailbox mMailbox;

    private ConvQuery(Mailbox mbox, ItemId convId) throws ServiceException {
        mMailbox = mbox;
        mConvId = convId;

        if (mConvId.getId() < 0) {
            // should never happen (make an ItemQuery instead
            throw ServiceException.FAILURE("Illegal Negative ConvID: " +
                    convId.toString() + ", use ItemQuery for virtual convs",
                    null);
        }
    }

    public static Query create(Mailbox mbox, String target)
        throws ServiceException {

        ItemId convId = new ItemId(target, mbox.getAccountId());
        if (convId.getId() < 0) {
            // ...convert negative convId to positive ItemId...
            convId = new ItemId(convId.getAccountId(), -1 * convId.getId());
            List<ItemId> iidList = new ArrayList<ItemId>(1);
            iidList.add(convId);
            return new ItemQuery(mbox, false, false, iidList);
        } else {
            return new ConvQuery(mbox, convId);
        }
    }

    @Override
    public QueryOperation getQueryOperation(boolean bool) {
        DBQueryOperation op = new DBQueryOperation();
        op.addConvId(mMailbox, mConvId, evalBool(bool));
        return op;
    }

    @Override
    public void dump(StringBuilder out) {
        out.append("CONV,");
        out.append(mConvId);
    }

}
