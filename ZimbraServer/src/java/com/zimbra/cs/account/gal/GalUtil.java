/*
 * 
 */
package com.zimbra.cs.account.gal;

import java.util.HashMap;
import java.util.Map;

import com.zimbra.common.service.ServiceException;
import com.zimbra.cs.account.ldap.LdapProvisioning;
import com.zimbra.cs.account.ldap.LdapUtil;

public class GalUtil {
    
    public static String expandFilter(String tokenize, String filterTemplate, String key, String token) 
    throws ServiceException {
        return expandFilter(tokenize, filterTemplate, key, token, null);
    }
    
    public static String expandFilter(String tokenize, String filterTemplate, String key, String token, String extraQuery) 
    throws ServiceException {
        String query;
        
        if (key != null) {
            while (key.startsWith("*")) key = key.substring(1);
            while (key.endsWith("*")) key = key.substring(0,key.length()-1);
        }
        query = expandKey(tokenize, filterTemplate, key);

        if (query.indexOf("**") > 0)
        	query = query.replaceAll("\\*\\*", "*");
        if (token != null && token.length() > 0) {
        	String arg = LdapUtil.escapeSearchFilterArg(token);
        	query = "(&(|(modifyTimeStamp>="+arg+")(createTimeStamp>="+arg+"))"+query+")";
        }
        
        if (extraQuery != null)
            query = "(&" + query + extraQuery + ")";
        
        return query;
    }
    
    public static String tokenizeKey(GalParams galParams, GalOp galOp) {
    	if (galParams == null)
    		return null;
        if (galOp == GalOp.autocomplete)
            return galParams.tokenizeAutoCompleteKey();
        else if (galOp == GalOp.search)
            return galParams.tokenizeSearchKey();
        
        return null;
    }
    
    private static String expandKey(String tokenize, String filterTemplate, String key) throws ServiceException {

        if (!filterTemplate.startsWith("(")) {
            if (filterTemplate.endsWith(")"))
                throw ServiceException.INVALID_REQUEST("Unbalanced parenthesis in filter:" + filterTemplate, null);
            
            filterTemplate = "(" + filterTemplate + ")";
        }
        
        String query = null;
        Map<String, String> vars = new HashMap<String, String>();
        
        if (tokenize != null) {
            String tokens[] = key.split("\\s+");
            if (tokens.length > 1) {
                String q;
                if (GalConstants.TOKENIZE_KEY_AND.equals(tokenize)) {
                    q = "(&";
                } else if (GalConstants.TOKENIZE_KEY_OR.equals(tokenize)) {
                    q = "(|";
                } else
                    throw ServiceException.FAILURE("invalid attribute value for tokenize key: " + tokenize, null);
                    
                for (String t : tokens) {
                    vars.clear();
                    vars.put("s", t);
                    q = q + LdapProvisioning.expandStr(filterTemplate, vars);
                }
                q = q + ")";
                query = q;
            }
        }
        
        if (query == null) {
            vars.put("s", key);
            query = LdapProvisioning.expandStr(filterTemplate, vars);
        }
        
        return query;
    }
   
}
