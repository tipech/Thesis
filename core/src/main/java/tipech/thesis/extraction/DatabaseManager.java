package tipech.thesis.extraction;

import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import java.util.stream.Stream;
import java.util.stream.Collectors;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import tipech.thesis.entities.FeedGroup;
import tipech.thesis.entities.Feed;
import tipech.thesis.entities.NewsItem;


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

	public void saveNews(List<NewsItem> newsList) throws SQLException {

		// drop table if exists
		Statement dropNewsItems = connection.createStatement();
		String dropNewsItemsSql = "DROP TABLE IF EXISTS news";

		dropNewsItems.executeUpdate(dropNewsItemsSql);
		dropNewsItems.close();

		// create a new table to hold news items
		Statement createNewsItems = connection.createStatement();
		String createNewsItemsSql = "CREATE TABLE news " +
			"(id 		INT PRIMARY KEY NOT NULL," +
			" keywords 	TEXT 			NOT NULL)";

		createNewsItems.executeUpdate(createNewsItemsSql);
		createNewsItems.close();


		// drop table if exists
		Statement dropNewsGroups = connection.createStatement();
		String dropNewsGroupsSql = "DROP TABLE IF EXISTS newsGroups";

		dropNewsGroups.executeUpdate(dropNewsGroupsSql);
		dropNewsGroups.close();

		// create a new table to hold news-group relations
		Statement createNewsGroups = connection.createStatement();
		String createNewsGroupsSql = "CREATE TABLE newsGroups " +
			"(id 			INT PRIMARY KEY NOT NULL," +
			" newsItemId 	INT 			NOT NULL," +
			" groupId 		INT 			NOT NULL)";

		createNewsGroups.executeUpdate(createNewsGroupsSql);
		createNewsGroups.close();


		// insert news items in a batch query
		PreparedStatement insertNewsItems = connection.prepareStatement(
				"INSERT INTO news ('id','keywords') VALUES(?, ?)"
			);

		// insert news-group relations in a batch query
		PreparedStatement insertNewsGroups = connection.prepareStatement(
				"INSERT INTO newsGroups ('id','newsItemId','groupId') VALUES(?, ?, ?)"
			);

		for (NewsItem item : newsList) {
			
			insertNewsItems.setInt(1, item.getId());
			insertNewsItems.setString(2, item.getKeywordString());
			insertNewsItems.addBatch();

			// get all the feedGroups for this news Item in [name=id] form
			Map<String,Integer> groupIds = item.getFeeds().stream()
				.flatMap( feed -> Stream.of( feed.getGroup() ) )
				// discard feeds from same group
				.collect( Collectors.toMap( FeedGroup::getName, FeedGroup::getId, (a, b) -> a ) ); 

			for (Map.Entry<String, Integer> group : groupIds.entrySet() ) {
				
				insertNewsGroups.setInt(1, newsGroupsRelCounter);
				insertNewsGroups.setInt(2, item.getId());
				insertNewsGroups.setInt(3, group.getValue());
				insertNewsGroups.addBatch();
				newsGroupsRelCounter++;
			}

		}
		insertNewsItems.executeBatch();
		insertNewsItems.close();

		insertNewsGroups.executeBatch();
		insertNewsGroups.close();

	}
}