/*
 * 
 */
package com.zimbra.common.util;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.apache.log4j.LogManager;
import org.apache.log4j.Logger;

/**
 * Factory that creates and manages instances of {@link Log}.
 * 
 * @author bburtin
 */
public class LogFactory {

    private static Map<String, Log> sLogsByName = new HashMap<String, Log>();
    
    public static Log getLog(Class<?> clazz) {
        if (clazz == null) {
            return null;
        }
        return getLog(clazz.getName());
    }
    
    public static Log getLog(String name) {
        Log log = null;
        
        synchronized (sLogsByName) {
            log = sLogsByName.get(name);
            if (log == null) {
                Logger log4jLogger = Logger.getLogger(name);
                log = new Log(log4jLogger);
                sLogsByName.put(name, log);
            }
        }        
        return log;
    }
    
    /**
     * Returns <tt>true</tt> if a logger with the given name exists.
     */
    public static boolean logExists(String name) {
        return (LogManager.exists(name) != null);
    }
    
    /**
     * Returns all account loggers that have been created since the last server start, or
     * an empty <tt>List</tt>.
     */
    public static List<AccountLogger> getAllAccountLoggers() {
        List<AccountLogger> accountLoggers = new ArrayList<AccountLogger>();
        List<Log> allLogs = new ArrayList<Log>();
        synchronized (sLogsByName) {
            allLogs.addAll(sLogsByName.values());
        }
        
        for (Log log : allLogs) {
            List<AccountLogger> alForCategory = log.getAccountLoggers();
            if (alForCategory != null) {
                accountLoggers.addAll(alForCategory);
            }
        } 
        return accountLoggers;
    }

    /**
     * Returns all the loggers that have been created with {@link #getLog}.  The
     * <tt>Collection</tt> does not include account loggers.
     */
    public static Collection<Log> getAllLoggers() {
        synchronized (sLogsByName) {
            List<Log> allLogs = new ArrayList<Log>();
            allLogs.addAll(sLogsByName.values());
            return allLogs;
        }
    }
}
