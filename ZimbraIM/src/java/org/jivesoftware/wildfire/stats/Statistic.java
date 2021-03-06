/*
 * 
 */
package org.jivesoftware.wildfire.stats;

/**
 * A statistic being tracked by the server
 */
public interface Statistic {

    /**
     * Returns the name of a stat.
     *
     * @return Returns the name of a stat.
     */
    public String getName();

    /**
     * Returns the type of a stat.
     *
     * @return Returns the type of a stat.
     */
    public Type getStatType();

    /**
     * Returns a description of the stat.
     *
     * @return Returns a description of the stat.
     */
    public String getDescription();

    /**
     * Returns the units that relate to the stat.
     *
     * @return Returns the units that relate to the stat.
     */
    public String getUnits();

    /**
     * @return Returns the sample of data.
     */
    public double sample();

    public enum Type {

        /**
         * Specifies a rate over time.
         * For example, the averave of kb/s in file transfers.
         */
        rate,
        /**
         * Specifies a count at a specific time period. An example would be the
         * number of users in MultiUserChat at this second.
         */
        count
    }
}
