package tipech.thesis.entities;


/*
 * Represents one stripped-down tweet
 */
public class Tweet {

	private long time;
	private String text;
	private String user;

	public Tweet(String rawTweet) {


	}

	public long getTime() {
		return time;
	}

	public String getText() {
		return text;
	}

	public String getUser() {
		return user;
	}

	@Override
	public String toString() {
		return "Tweet [text=" + text + ", time=" + time + ", user=" + user + "]";
	}

}