/*
 * 
 */
package com.zimbra.cs.index;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

import com.zimbra.common.service.ServiceException;
import com.zimbra.cs.localconfig.DebugConfig;

/**
 * QueryResults wrapper that implements Re-Sorting.  It does this by caching **ALL** 
 * hits and then sorting them.  It is used for the Task sorts as well as specially localized
 * language sorts
 */
public class ReSortingQueryResults implements ZimbraQueryResults {

    ReSortingQueryResults(ZimbraQueryResults results, SortBy desiredSort, SearchParams params) throws ServiceException {
        mResults = results;
        mDesiredSort = desiredSort;
        mParams = params;
    }
    
    /* @see com.zimbra.cs.index.ZimbraQueryResults#doneWithSearchResults() */
    public void doneWithSearchResults() throws ServiceException {
        mResults.doneWithSearchResults();
    }

    /* @see com.zimbra.cs.index.ZimbraQueryResults#estimateResultSize() */
    public int estimateResultSize() throws ServiceException {
        return mResults.estimateResultSize();
    }

    /* @see com.zimbra.cs.index.ZimbraQueryResults#getFirstHit() */
    public ZimbraHit getFirstHit() throws ServiceException {
        mIterOffset = 0;
        return getNext();
    }

    /* @see com.zimbra.cs.index.ZimbraQueryResults#getNext() */
    public ZimbraHit getNext() throws ServiceException {
        if (hasNext()) {
            ZimbraHit toRet = peekNext();
            mIterOffset++;
            return toRet;
        } else
            return null;
    }

    /* @see com.zimbra.cs.index.ZimbraQueryResults#getResultInfo() */
    public List<QueryInfo> getResultInfo() {
        return mResults.getResultInfo();
    }

    /* @see com.zimbra.cs.index.ZimbraQueryResults#getSortBy() */
    public SortBy getSortBy() {
        return mDesiredSort;
    }

    /* @see com.zimbra.cs.index.ZimbraQueryResults#hasNext() */
    public boolean hasNext() throws ServiceException {
        List<ZimbraHit> buffer = getHitBuffer();
        return (mIterOffset < buffer.size());
    }

    /* @see com.zimbra.cs.index.ZimbraQueryResults#peekNext() */
    public ZimbraHit peekNext() throws ServiceException {
        List<ZimbraHit> buffer = getHitBuffer();
        if (hasNext())
            return buffer.get(mIterOffset);
        else
            return null;
    }

    /* @see com.zimbra.cs.index.ZimbraQueryResults#resetIterator() */
    public void resetIterator() throws ServiceException {
        mIterOffset = 0;
    }

    /* @see com.zimbra.cs.index.ZimbraQueryResults#skipToHit(int) */
    public ZimbraHit skipToHit(int hitNo) throws ServiceException {
        List<ZimbraHit> buffer = getHitBuffer();
        if (hitNo >= buffer.size()) {
            mIterOffset = buffer.size(); 
        } else {
            mIterOffset = hitNo;
        }
        return getNext();
    }
    
    private List<ZimbraHit> getHitBuffer() throws ServiceException {
        if (mHitBuffer == null)
            bufferAllHits();
        return mHitBuffer;
    }
    
    private boolean isTaskSort() {
        switch (mDesiredSort.getType()) {
            case TASK_DUE_ASCENDING:
            case TASK_DUE_DESCENDING:
            case TASK_STATUS_ASCENDING:
            case TASK_STATUS_DESCENDING:
            case TASK_PERCENT_COMPLETE_ASCENDING:
            case TASK_PERCENT_COMPLETE_DESCENDING:
                return true;
        }
        return false;
    }
    
    private void bufferAllHits() throws ServiceException {
        assert(mHitBuffer == null);
        mHitBuffer = new ArrayList<ZimbraHit>();

        // get the proper comparator
        Comparator<ZimbraHit> comp;
        switch (mDesiredSort.getType()) {
            default:
            case TASK_DUE_ASCENDING:
                comp = new Comparator<ZimbraHit>() {
                    public int compare(ZimbraHit lhs, ZimbraHit rhs) {
                        return TaskHit.compareByDueDate(true, lhs, rhs);
                    }
                };
                break;
            case TASK_DUE_DESCENDING:
                comp = new Comparator<ZimbraHit>() {
                        public int compare(ZimbraHit lhs, ZimbraHit rhs) {
                            return TaskHit.compareByDueDate(false, lhs, rhs);
                        }
                    };
                    break;
            case TASK_STATUS_ASCENDING:
                comp = new Comparator<ZimbraHit>() {
                        public int compare(ZimbraHit lhs, ZimbraHit rhs) {
                            return TaskHit.compareByStatus(true, lhs, rhs);
                        }
                    };
                    break;
            case TASK_STATUS_DESCENDING:
                comp = new Comparator<ZimbraHit>() {
                        public int compare(ZimbraHit lhs, ZimbraHit rhs) {
                            return TaskHit.compareByStatus(false, lhs, rhs);
                        }
                    };
                    break;
            case TASK_PERCENT_COMPLETE_ASCENDING:
                comp = new Comparator<ZimbraHit>() {
                        public int compare(ZimbraHit lhs, ZimbraHit rhs) {
                            return TaskHit.compareByCompletionPercent(true, lhs, rhs);
                        }
                    };                        
                    break;
            case TASK_PERCENT_COMPLETE_DESCENDING:
                comp = new Comparator<ZimbraHit>() {
                        public int compare(ZimbraHit lhs, ZimbraHit rhs) {
                            return TaskHit.compareByCompletionPercent(false, lhs, rhs);
                        }
                    };                        
                    break;
            case NAME_LOCALIZED_ASCENDING:
            case NAME_LOCALIZED_DESCENDING:
                comp = ((LocalizedSortBy)mDesiredSort).getZimbraHitComparator();
                break;
        }
        

        ZimbraHit cur;
        while ((cur = mResults.getNext()) != null) {
            
            if (isTaskSort()) {
                if (!(cur instanceof TaskHit) && !(cur instanceof ProxiedHit)) {
                    throw ServiceException.FAILURE("Invalid hit type, can only task-sort Tasks", null);
                }
            }

            boolean skipHit = false;
            
            boolean handleCursorFilteringForFirstHit = true;
            if (DebugConfig.enableContactLocalizedSort) {
                if (mDesiredSort.getType() == SortBy.Type.NAME_LOCALIZED_ASCENDING || mDesiredSort.getType() == SortBy.Type.NAME_LOCALIZED_DESCENDING)
                    handleCursorFilteringForFirstHit = false;
            }
            
            // handle cursor filtering
            if (mParams != null && mParams.hasCursor()) {
                ZimbraHit firstHit = null;
                if (mParams.getPrevSortValueStr() != null) 
                    firstHit = new ResultsPager.DummyHit(mParams.getPrevSortValueStr(),
                                                         mParams.getPrevSortValueStr(),
                                                         mParams.getPrevSortValueLong(),
                                                         mParams.getPrevMailItemId().getId());
                
                ZimbraHit endHit = null;
                if (mParams.getEndSortValueStr() != null)
                    endHit = new ResultsPager.DummyHit(mParams.getEndSortValueStr(),
                                                       mParams.getEndSortValueStr(),
                                                       mParams.getEndSortValueLong(),
                                                       0);
                
                // fail if cur < first OR cur >= end 
                if (handleCursorFilteringForFirstHit) {
                    if (firstHit != null && comp.compare(cur, firstHit) < 0)
                        skipHit = true;
                }
                if (endHit != null && comp.compare(cur, endHit) >= 0)
                    skipHit = true;
            }

            if (!skipHit)
                mHitBuffer.add(cur);
            
            if (mHitBuffer.size() >= MAX_BUFFERED_HITS) {
                break;
            }
            
        }
        Collections.sort(mHitBuffer, comp);
    }
    
    static final int MAX_BUFFERED_HITS = 10000;
    
    private ZimbraQueryResults mResults;
    private SortBy mDesiredSort;
    private List<ZimbraHit> mHitBuffer = null;
    private int mIterOffset = 0;
    private SearchParams mParams = null;
}
