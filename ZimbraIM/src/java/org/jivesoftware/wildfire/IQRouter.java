/*
 * 
 */
package org.jivesoftware.wildfire;

import org.dom4j.Element;
import org.jivesoftware.util.LocaleUtils;
import org.jivesoftware.util.Log;
import org.jivesoftware.wildfire.auth.UnauthorizedException;
import org.jivesoftware.wildfire.container.BasicModule;
import org.jivesoftware.wildfire.handler.IQHandler;
import org.jivesoftware.wildfire.privacy.PrivacyList;
import org.jivesoftware.wildfire.privacy.PrivacyListManager;
import org.jivesoftware.wildfire.user.UserManager;
import org.xmpp.packet.IQ;
import org.xmpp.packet.JID;
import org.xmpp.packet.PacketError;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Routes iq packets throughout the server. Routing is based on the recipient
 * and sender addresses. The typical packet will often be routed twice, once
 * from the sender to some internal server component for handling or processing,
 * and then back to the router to be delivered to it's final destination.
 *
 * @author Iain Shigeoka
 */
public class IQRouter extends BasicModule {

    private RoutingTable routingTable;
    private MulticastRouter multicastRouter;
    private List<IQHandler> iqHandlers = new ArrayList<IQHandler>();
    private Map<String, IQHandler> namespace2Handlers = new ConcurrentHashMap<String, IQHandler>();
    private Map<String, IQResultListener> resultListeners =
            new ConcurrentHashMap<String, IQResultListener>();
    private SessionManager sessionManager;
    private UserManager userManager;

    /**
     * Creates a packet router.
     */
    public IQRouter() {
        super("XMPP IQ Router");
    }
    
    private Collection<String> getServerNames() {
        return XMPPServer.getInstance().getLocalDomains();
    }

    /**
     * <p>Performs the actual packet routing.</p>
     * <p>You routing is considered 'quick' and implementations may not take
     * excessive amounts of time to complete the routing. If routing will take
     * a long amount of time, the actual routing should be done in another thread
     * so this method returns quickly.</p>
     * <h2>Warning</h2>
     * <p>Be careful to enforce concurrency DbC of concurrent by synchronizing
     * any accesses to class resources.</p>
     *
     * @param packet The packet to route
     * @throws NullPointerException If the packet is null
     */
    public void route(IQ packet) {
        if (packet == null) {
            throw new NullPointerException();
        }
        Session session = sessionManager.getSession(packet.getFrom());
        JID to = packet.getTo();
        if (session != null && to != null && session.getStatus() == Session.STATUS_CONNECTED &&
                    !getServerNames().contains(to.toString())) {
            // User is requesting this server to authenticate for another server. Return
            // a bad-request error
            IQ reply = IQ.createResultIQ(packet);
            reply.setChildElement(packet.getChildElement().createCopy());
            reply.setError(PacketError.Condition.bad_request);
            sessionManager.getSession(packet.getFrom()).process(reply);
            Log.warn("User tried to authenticate with this server using an unknown receipient: " +
                    packet);
        }
        else if (session == null || session.getStatus() == Session.STATUS_AUTHENTICATED || (
                isLocalServer(to) && (
                        "jabber:iq:auth".equals(packet.getChildElement().getNamespaceURI()) ||
                                "jabber:iq:register"
                                        .equals(packet.getChildElement().getNamespaceURI()) ||
                                "urn:ietf:params:xml:ns:xmpp-bind"
                                        .equals(packet.getChildElement().getNamespaceURI())))) {
            handle(packet);
        }
        else {
            IQ reply = IQ.createResultIQ(packet);
            reply.setChildElement(packet.getChildElement().createCopy());
            reply.setError(PacketError.Condition.not_authorized);
            sessionManager.getSession(packet.getFrom()).process(reply);
        }
    }

    /**
     * <p>Adds a new IQHandler to the list of registered handler. The new IQHandler will be
     * responsible for handling IQ packet whose namespace matches the namespace of the
     * IQHandler.</p>
     *
     * An IllegalArgumentException may be thrown if the IQHandler to register was already provided
     * by the server. The server provides a certain list of IQHandlers when the server is
     * started up.
     *
     * @param handler the IQHandler to add to the list of registered handler.
     */
    public void addHandler(IQHandler handler) {
        if (iqHandlers.contains(handler)) {
            throw new IllegalArgumentException("IQHandler already provided by the server");
        }
        // Ask the handler to be initialized
        handler.initialize(XMPPServer.getInstance());
        // Register the handler as the handler of the namespace
        namespace2Handlers.put(handler.getInfo().getNamespace(), handler);
    }

    /**
     * <p>Removes an IQHandler from the list of registered handler. The IQHandler to remove was
     * responsible for handling IQ packet whose namespace matches the namespace of the
     * IQHandler.</p>
     *
     * An IllegalArgumentException may be thrown if the IQHandler to remove was already provided
     * by the server. The server provides a certain list of IQHandlers when the server is
     * started up.
     *
     * @param handler the IQHandler to remove from the list of registered handler.
     */
    public void removeHandler(IQHandler handler) {
        if (iqHandlers.contains(handler)) {
            throw new IllegalArgumentException("Cannot remove an IQHandler provided by the server");
        }
        // Unregister the handler as the handler of the namespace
        namespace2Handlers.remove(handler.getInfo().getNamespace());
    }

    /**
     * Adds an {@link IQResultListener} that will be invoked when an IQ result is sent to the
     * server itself and is of type result or error. This is a nice way for the server to
     * send IQ packets to other XMPP entities and be waked up when a response is received back.<p>
     *
     * Once an IQ result was received, the listener will be invoked and removed from
     * the list of listeners.
     *
     * @param id the id of the IQ packet being sent from the server to an XMPP entity.
     * @param listener the IQResultListener that will be invoked when an answer is received
     */
    public void addIQResultListener(String id, IQResultListener listener) {
        // TODO Add a check that if no IQ reply was received for a while then an IQ error should
        // be generated by the server and simulate like the client sent it. This will let listeners
        // react and be removed from the collection
        resultListeners.put(id, listener);
    }

    public void initialize(XMPPServer server) {
        super.initialize(server);
        routingTable = server.getRoutingTable();
        multicastRouter = server.getMulticastRouter();
        iqHandlers.addAll(server.getIQHandlers());
        sessionManager = server.getSessionManager();
        userManager = server.getUserManager();
    }

    /**
     * A JID is considered local if:
     * 1) is null or
     * 2) has no domain or domain is empty or
     * 3) has no resource or resource is empty
     */
    private boolean isLocalServer(JID recipientJID) {
        return recipientJID == null || recipientJID.getDomain() == null
                || "".equals(recipientJID.getDomain()) || recipientJID.getResource() == null
                || "".equals(recipientJID.getResource());
    }

    private void handle(IQ packet) {
        JID recipientJID = packet.getTo();
        // Check if the packet was sent to the server hostname
        if (recipientJID != null && recipientJID.toBareJID() == null &&
                    recipientJID.getResource() == null && getServerNames().contains(recipientJID.getDomain())) {
            Element childElement = packet.getChildElement();
            if (childElement != null && childElement.element("addresses") != null) {
                // Packet includes multicast processing instructions. Ask the multicastRouter
                // to route this packet
                multicastRouter.route(packet);
                return;
            }
            else if (IQ.Type.result == packet.getType() || IQ.Type.error == packet.getType()) {
                // The server got an answer to an IQ packet that was sent from the server
                IQResultListener iqResultListener = resultListeners.remove(packet.getID());
                if (iqResultListener != null) {
                    try {
                        iqResultListener.receivedAnswer(packet);
                    }
                    catch (Exception e) {
                        Log.error("Error processing answer of remote entity", e);
                    }
                    return;
                }
            }
        }
        try {
            // Check for registered components, services or remote servers
            if (recipientJID != null) {
                ChannelHandler serviceRoute = routingTable.getRoute(recipientJID);
                if (serviceRoute != null && !(serviceRoute instanceof ClientSession)) {
                    // A component/service/remote server was found that can handle the Packet
                    serviceRoute.process(packet);
                    return;
                }
            }
            if (isLocalServer(recipientJID)) {
                // Let the server handle the Packet
                Element childElement = packet.getChildElement();
                String namespace = null;
                if (childElement != null) {
                    namespace = childElement.getNamespaceURI();
                }
                if (namespace == null) {
                    if (packet.getType() != IQ.Type.result) {
                        // Do nothing. We can't handle queries outside of a valid namespace
                        Log.warn("Unknown packet " + packet);
                    }
                }
                else {
                    // Check if communication to local users is allowed
                    if (recipientJID != null &&
                            userManager.isRegisteredUser(recipientJID.toBareJID())) {
                        PrivacyList list = PrivacyListManager.getInstance()
                                .getDefaultPrivacyList(recipientJID.toBareJID());
                        if (list != null && list.shouldBlockPacket(packet)) {
                            // Communication is blocked
                            if (IQ.Type.set == packet.getType() || IQ.Type.get == packet.getType()) {
                                // Answer that the service is unavailable
                                sendErrorPacket(packet, PacketError.Condition.service_unavailable);
                            }
                            return;
                        }
                    }
                    IQHandler handler = getHandler(namespace);
                    if (handler == null) {
                        if (recipientJID == null) {
                            // Answer an error since the server can't handle the requested namespace
                            sendErrorPacket(packet, PacketError.Condition.service_unavailable);
                        }
                        else if (recipientJID.toBareJID() == null ||
                                "".equals(recipientJID.toBareJID())) {
                            // Answer an error if JID is of the form <domain>
                            sendErrorPacket(packet, PacketError.Condition.feature_not_implemented);
                        }
                        else {
                            // JID is of the form <node@domain>
                            // Answer an error since the server can't handle packets sent to a node
                            sendErrorPacket(packet, PacketError.Condition.service_unavailable);
                        }
                    }
                    else {
                        handler.process(packet);
                    }
                }

            }
            else {
                // JID is of the form <node@domain/resource>
                boolean handlerFound = false;
                // IQ packets should be sent to users even before they send an available presence.
                // So if the target address belongs to this server then use the sessionManager
                // instead of the routingTable since unavailable clients won't have a route to them
                if (XMPPServer.getInstance().isLocal(recipientJID)) {
//                    ClientSession session = sessionManager.getBestRoute(recipientJID);
                    ClientSession session = sessionManager.getSession(recipientJID);
                    if (session != null) {
                        if (!session.shouldBlockPacket(packet)) {
                            session.process(packet);
                            handlerFound = true;
                        }
                    }
                    else {
                        Log.info("Packet sent to unreachable address " + packet);
                    }
                }
                else {
                    ChannelHandler route = routingTable.getRoute(recipientJID);
                    if (route != null) {
                        route.process(packet);
                        handlerFound = true;
                    }
                    else {
                        Log.info("Packet sent to unreachable address " + packet);
                    }
                }
                // If a route to the target address was not found then try to answer a
                // service_unavailable error code to the sender of the IQ packet
                if (!handlerFound && IQ.Type.result != packet.getType()) {
                    sendErrorPacket(packet, PacketError.Condition.service_unavailable);
                }
            }
        }
        catch (Exception e) {
            Log.error(LocaleUtils.getLocalizedString("admin.error.routing"), e);
            Session session = sessionManager.getSession(packet.getFrom());
            if (session != null) {
                Connection conn = session.getConnection();
                if (conn != null) {
                    conn.close();
                }
            }
        }
    }

    private void sendErrorPacket(IQ originalPacket, PacketError.Condition condition)
            throws UnauthorizedException {
        IQ reply = IQ.createResultIQ(originalPacket);
        reply.setChildElement(originalPacket.getChildElement().createCopy());
        reply.setError(condition);
        // Check if the server was the sender of the IQ
        if (getServerNames().contains(originalPacket.getFrom().toString())) {
            // Just let the IQ router process the IQ error reply
            handle(reply);
            return;
        }
        // Locate a route to the sender of the IQ and ask it to process
        // the packet. Use the routingTable so that routes to remote servers
        // may be found
        ChannelHandler route = routingTable.getRoute(originalPacket.getFrom());
        if (route != null) {
            route.process(reply);
        }
        else {
            // No root was found so try looking for local sessions that have never
            // sent an available presence or haven't authenticated yet
            Session session = sessionManager.getSession(originalPacket.getFrom());
            if (session != null) {
                session.process(reply);
            }
            else {
                Log.warn("Error packet could not be delivered " + reply);
            }
        }
    }

    private IQHandler getHandler(String namespace) {
        IQHandler handler = namespace2Handlers.get(namespace);
        if (handler == null) {
            for (IQHandler handlerCandidate : iqHandlers) {
                IQHandlerInfo handlerInfo = handlerCandidate.getInfo();
                if (handlerInfo != null && namespace.equalsIgnoreCase(handlerInfo.getNamespace())) {
                    handler = handlerCandidate;
                    namespace2Handlers.put(namespace, handler);
                    break;
                }
            }
        }
        return handler;
    }
}