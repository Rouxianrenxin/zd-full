/*
 * 
 */
package com.zimbra.cs.offline;

import java.io.File;
import java.io.IOException;
import java.io.StringReader;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.zimbra.common.localconfig.LC;
import com.zimbra.common.service.ServiceException;
import com.zimbra.common.util.ByteUtil;
import com.zimbra.common.util.FileUtil;
import com.zimbra.common.util.StringUtil;
import com.zimbra.cs.account.offline.OfflineProvisioning;
import com.zimbra.cs.db.Db;
import com.zimbra.cs.db.DbPool;
import com.zimbra.cs.db.DbUtil;
import com.zimbra.cs.db.OfflineDbPool;
import com.zimbra.cs.db.OfflineVersions;
import com.zimbra.cs.mailbox.AutoArchiveTimer;
import com.zimbra.cs.offline.backup.BackupTimer;
import com.zimbra.cs.offline.backup.DelEmailTimer;
import com.zimbra.cs.service.AuthProvider;
import com.zimbra.cs.service.offline.OfflineZimbraAuthProvider;
import com.zimbra.cs.store.file.Volume;
import com.zimbra.cs.util.ZimbraApplication;
import com.zimbra.cs.zimlet.ZimletFile;
import com.zimbra.cs.zimlet.ZimletUtil;

public class OfflineApplication extends ZimbraApplication {
    private static String[] sqlScripts = {
        "db", "directory", "wildfire", "versions-init", "default-volumes"
    };
    private static String ZIMBRA_DB_NAME = "zimbra";

    private List<String> extensionNames;

    @Override
    public String getId() {
        return OfflineLC.zdesktop_app_id.value();
    }

    @Override
    public String getClientId() {
        try {
            return OfflineProvisioning.getOfflineInstance().getClientId();
        } catch (ServiceException x) {
            OfflineLog.offline.warn("Unable to get client ID", x);
        }
        return null;
    }

    @Override
    public boolean supports(String className) {
        return false;
    }

    @Override
    public void addExtensionName(String name) {
        (extensionNames == null ? extensionNames = new ArrayList<String>() : extensionNames).add(name);
        OfflineLog.offline.info("added extension: %s", name);
    }

    @Override
    public List<String> getExtensionNames() {
        return extensionNames;
    }

    @Override
    public void initialize(boolean forMailboxd) {
        deployZimlets();
        AuthProvider.register(new OfflineZimbraAuthProvider());
        AuthProvider.refresh();
        try {
            if (!forMailboxd)
                return;

            long threshold = OfflineLC.zdesktop_volume_compression_threshold.longValue();
            Volume vol = Volume.getCurrentMessageVolume();

            // in offline, we always use the relative path "store" for message volume
            if (vol.getCompressionThreshold() != threshold) {
                Volume.update(vol.getId(), vol.getType(), vol.getName(),
                        "store", vol.getMboxGroupBits(), vol.getMboxBits(),
                        vol.getFileGroupBits(), vol.getFileBits(), threshold != 0,
                        threshold == 0 ? vol.getCompressionThreshold() : threshold, true);
                Volume.reloadVolumes();
            }
        } catch (ServiceException e) {
            OfflineLog.offline.warn("Unable to update volume compression", e);
        }
        BackupTimer.initialize();
        DelEmailTimer.initialize();
        try {
            OfflineLog.offline.info("Initializing auto archiving timer");
            AutoArchiveTimer.initialize();
        } catch (ServiceException e) {
            OfflineLog.offline.error("Exception in initializing auto archive timer " + e);
        }
    }

    public void initializeZimbraDb(boolean forMailboxd) throws ServiceException {
        if (!forMailboxd)
            return;

        DbPool.Connection conn = DbPool.getConnection();
        try {
            if (Db.getInstance().databaseExists(conn, ZIMBRA_DB_NAME)) {
                migrateDb(conn);
                OfflineLog.offline.debug("zimbra db optimize started...");
                Db.getInstance().optimize(conn, ZIMBRA_DB_NAME, 0);
                OfflineLog.offline.debug("zimbra db optimize done");
            } else {
                File file = null;
                PreparedStatement stmt = null;

                OfflineLog.offline.info("Creating database " + ZIMBRA_DB_NAME);
                for (String name : sqlScripts) {
                    try {
                        file = new File(LC.mailboxd_directory.value() + "/../db/" + name + ".sql");

                        String script;
                        String template = new String(ByteUtil.getContent(file));
                        Map<String, String> vars = new HashMap<String, String>();

                        vars.put("ZIMBRA_HOME", LC.zimbra_home.value() + '/');
                        vars.put("ZIMBRA_INSTALL", LC.zimbra_home.value() + '/');
                        script = StringUtil.fillTemplate(template, vars, StringUtil.atPattern);
                        DbUtil.executeScript(conn, new StringReader(script));
                    } catch (IOException e) {
                        throw ServiceException.FAILURE("unable to read SQL statements from " +
                                file.getPath(), e);
                    } catch (SQLException e) {
                        throw ServiceException.FAILURE("unable to run " +
                                ZIMBRA_DB_NAME + " db script" + file.getPath(), e);
                    } finally {
                        DbPool.closeStatement(stmt);
                    }
                }
                try {
                    stmt = conn.prepareStatement("INSERT INTO config(name, value, description) VALUES ('offline.db.version', '" +
                            OfflineVersions.OFFLINE_DB_VERSION + "', 'offline db schema version')");
                    stmt.executeUpdate();
                    conn.commit();
                } catch (SQLException e) {
                    throw ServiceException.FAILURE("unable to set offline db version", e);
                } finally {
                    DbPool.closeStatement(stmt);
                }
            }
        } finally {
            conn.close();
        }
    }

    @Override
    public void shutdown() {
        super.shutdown();
        try {
            OfflineDbPool.shutdown();
        } catch (Exception e) {
        }
        OfflineSyncManager.getInstance().shutdown();
        BackupTimer.shutdown();
        DelEmailTimer.shutdown();
        AutoArchiveTimer.shutdown();
    }

    private void migrateDb(DbPool.Connection conn) {
        try {
            OfflineLog.offline.debug("DB migration check started...");
            new com.zimbra.cs.db.DbOfflineMigration().run(conn);
            OfflineLog.offline.debug("DB migration done");
        } catch (SQLException e) {
            OfflineLog.offline.error("DB migration sql error: " + e.getMessage());
        } catch (Exception e) {
            OfflineLog.offline.error("DB migration error: " + e.getMessage());
        }
    }

    private void deployZimlets() {
        OfflineLog.offline.debug("Deploying new zimlets...");

        File zimletDir = new File(LC.zimbra_home.value() + File.separator + "zimlets");
        if (zimletDir == null || !zimletDir.exists() || !zimletDir.isDirectory()) {
            OfflineLog.offline.debug("Invalid zimlets directory: " + zimletDir.getPath());
            return;
        }

        String[] zimlets = zimletDir.list();
        if (zimlets == null) {
            OfflineLog.offline.debug("No zimlets found at " + zimletDir.getPath());
            return;
        }

        ArrayList<File> filesToDel = new ArrayList<File>();
        for (int i = 0; i < zimlets.length; i++) {
            try {
                File zimletFile = new File(zimletDir.getPath() + File.separator + zimlets[i]);
                if (zimletFile.isDirectory())
                    continue;
                ZimletUtil.deployZimlet(new ZimletFile(zimletDir, zimlets[i]));
                OfflineLog.offline.debug("Zimlet deployed:  " + zimlets[i]);
                filesToDel.add(zimletFile);
            } catch (Exception e) {
                OfflineLog.offline.warn("Fail to deploy zimlet " + zimlets[i] + ": " + e.getMessage());
            }
        }
        for (File zimletFile : filesToDel) {
            try {
                FileUtil.delete(zimletFile);
            } catch (IOException e) {
                OfflineLog.offline.warn("Zimlets file delete failed: " + zimletFile);
            }
        }
        OfflineLog.offline.debug("Zimlets deployment done.");
    }
}
