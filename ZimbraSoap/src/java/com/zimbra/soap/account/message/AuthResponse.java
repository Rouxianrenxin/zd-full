/*
 * 
 */

package com.zimbra.soap.account.message;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;

import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlElementWrapper;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlType;

import com.google.common.collect.Multimap;
import com.zimbra.common.soap.AccountConstants;
import com.zimbra.soap.account.type.Attr;
import com.zimbra.soap.account.type.Pref;
import com.zimbra.soap.account.type.Session;


/*
<AuthResponse">
   <authToken>...</authToken>
   <lifetime>...</lifetime>
   <session .../>
   <refer>{mail-host}</refer>  
   [<prefs><pref name="{name}" modified="{modified-time}">{value}</pref>...</prefs>]
   [<attrs><attr name="{name}">{value}</a>...</attrs>]
   [<skin>{skin-name}</skin>]
 </AuthResponse>
 */
@XmlRootElement(name="AuthResponse")
@XmlType(propOrder = {})
public class AuthResponse {

    @XmlElement(required=true) private String authToken;
    @XmlElement(required=true) private long lifetime;
    @XmlElement                private Session session;
    @XmlElement                private String refer;
    @XmlElement                private String skin;
    
    @XmlElementWrapper(name="prefs")
    @XmlElement(name="pref")
    private List<Pref> prefs = new ArrayList<Pref>();
    
    @XmlElementWrapper(name="attrs")
    @XmlElement(name="attr")
    private List<Attr> attrs = new ArrayList<Attr>();

    @XmlElement(name=AccountConstants.E_TWO_FACTOR_AUTH_REQUIRED, required=false)
    private boolean twoFactorAuthRequired;

    /**
     * @zm-api-field-description trusted device token
     */
    @XmlElement(name=AccountConstants.E_TRUSTED_TOKEN /* trustedToken */, required=false)
    private String trustedToken;


    public AuthResponse() {
    }
    
    public AuthResponse(String authToken, long lifetime) {
        setAuthToken(authToken);
        setLifetime(lifetime);
    }
    
    public String getAuthToken() { return authToken; }
    public AuthResponse setAuthToken(String authToken) { this.authToken = authToken; return this; }
    
    public long getLifetime() { return lifetime; }
    public AuthResponse setLifetime(long lifetime) { this.lifetime = lifetime; return this; }
    
    public Session getSession() { return session; }
    public AuthResponse setSession(Session session) { this.session = session; return this; }
    
    public String getRefer() { return refer; }
    public AuthResponse setRefer(String refer) { this.refer = refer; return this; }
    
    public String getSkin() { return skin; }
    public AuthResponse setSkin(String skin) { this.skin = skin; return this; }
    
    public List<Pref> getPrefs() { return Collections.unmodifiableList(prefs); }
    public AuthResponse setPrefs(Collection<Pref> prefs) {
        this.prefs.clear();
        if (prefs != null) {
            this.prefs.addAll(prefs);
        }
        return this;
    }
    
    public List<Attr> getAttrs() { return Collections.unmodifiableList(attrs); }
    public AuthResponse setAttrs(Collection<Attr> attrs) {
        this.attrs.clear();
        if (attrs != null) {
            this.attrs.addAll(attrs);
        }
        return this;
    }

    public Multimap<String, String> getAttrsMultimap() {
        return Attr.toMultimap(attrs);
    }
    
    public Multimap<String, String> getPrefsMultimap() {
        return Pref.toMultimap(prefs);
    }

    public boolean getTwoFactorAuthRequired() {
        return twoFactorAuthRequired;
    }

    public AuthResponse setTwoFactorAuthRequired(boolean bool) {
        this.twoFactorAuthRequired = bool;
        return this;
    }

    public String getTrustedToken() {
        return trustedToken;
    }

    public AuthResponse setTrustedToken(String trustedToken) {
        this.trustedToken = trustedToken;
        return this;
    }

}
