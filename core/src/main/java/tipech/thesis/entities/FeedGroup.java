package tipech.thesis.entities;

import java.util.ArrayList;
import java.util.List;

import java.util.concurrent.atomic.AtomicInteger;

/*
 * Stores a group of RSS feeds
 */
public class FeedGroup {

	private static AtomicInteger uniqueId = new AtomicInteger();

	private int id;
	private final String name;
	private final String color;

	private final List<String> feedUrls = new ArrayList<String>();

	public FeedGroup(String name, String color) {
		this.name = name;
		this.color = color;
	}

	public List<String> getFeedUrls() {
		return feedUrls;
	}

	public String getName() {
		return name;
	}

	public String getColor() {
		return color;
	}

	public void updateId() {
		id = uniqueId.getAndIncrement();		
	}

	public int getId() {
		return id;
	}

	@Override
	public String toString() {
		return "Feed group: " + name + " [color=" + color + ", id=" + id + "]";
	}

}