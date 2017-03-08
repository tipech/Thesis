package tipech.thesis.entities;

import java.util.ArrayList;
import java.util.List;

/*
 * Stores a group of RSS feeds
 */
public class FeedGroup {

	final String name;
	final String color;

	final List<String> feeds = new ArrayList<String>();

	public FeedGroup(String name, String color) {
		this.name = name;
		this.color = color;
	}

	public List<String> getFeeds() {
		return feeds;
	}

	public String getName() {
		return name;
	}

	public String getColor() {
		return color;
	}

	@Override
	public String toString() {
		return "Feed group: " + name + " [color=" + color + "]";
	}

}