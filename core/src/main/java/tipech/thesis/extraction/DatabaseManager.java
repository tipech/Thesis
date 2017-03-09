package tipech.thesis.extraction;

import java.util.List;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import tipech.thesis.entities.FeedGroup;
import tipech.thesis.entities.Feed;


/*
 * Manages all database actions
 */
public class DatabaseManager {

	private Connection connection = null;

	public DatabaseManager() throws SQLException {

		String url = "jdbc:sqlite:data.db";

		Connection newConnection = DriverManager.getConnection(url);
		if (newConnection != null) {
			connection = newConnection;
		}
	}

	public void close() throws SQLException {

		connection.close();
	}

	public void saveFeedGroups(List<FeedGroup> groupList) throws SQLException {

		// drop table if exists
		Statement drop = connection.createStatement();
		String dropSql = "DROP TABLE IF EXISTS groups";

		drop.executeUpdate(dropSql);
		drop.close();

		// create a new table
		Statement create = connection.createStatement();
		String createSql = "CREATE TABLE groups " +
			"(id 	INT PRIMARY KEY NOT NULL," +
			" name 	TEXT 			NOT NULL," +
			" color TEXT 			NOT NULL)";

		create.executeUpdate(createSql);
		create.close();

		// insert groups in a batch query
		PreparedStatement insert = connection.prepareStatement(
				"INSERT INTO groups ('id','name','color') VALUES(?, ?, ?)"
			);

		for (FeedGroup group : groupList) {
			
			insert.setInt(1, group.getId());
			insert.setString(2, group.getName());
			insert.setString(3, group.getColor());
			insert.addBatch();
		}
		insert.executeBatch();
		insert.close();
	}

	public void saveFeeds(List<Feed> feedList) throws SQLException {

		// drop table if exists
		Statement drop = connection.createStatement();
		String dropSql = "DROP TABLE IF EXISTS feeds";

		drop.executeUpdate(dropSql);
		drop.close();

		// create a new table
		Statement create = connection.createStatement();
		String createSql = "CREATE TABLE feeds " +
			"(id 		INT PRIMARY KEY NOT NULL," +
			" url 		TEXT 			NOT NULL," +
			" feedGroup INT 			NOT NULL)";

		create.executeUpdate(createSql);
		create.close();

		// insert feeds in a batch query
		PreparedStatement insert = connection.prepareStatement(
				"INSERT INTO feeds ('id','url','feedGroup') VALUES(?, ?, ?)"
			);

		for (Feed feed : feedList) {
			
			insert.setInt(1, feed.getId());
			insert.setString(2, feed.getUrl());
			insert.setInt(3, feed.getGroup().getId());
			insert.addBatch();
		}
		insert.executeBatch();
		insert.close();
	}
}