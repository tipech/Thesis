package tipech.thesis.entities;

import java.util.ArrayList;
import java.util.List;

import java.time.LocalDate;

import com.google.gson.Gson;
import com.google.gson.JsonParser;
import com.google.gson.JsonObject;
import com.google.gson.JsonElement;
import com.google.gson.JsonArray;

/*
 * Stores a message from the control backend
 */
public class ControlMessage {

	final String command;
	final LocalDate rejectDate; // reject everything before that date
	// final String dataRate;
	// final String rssRate;

	final List<FeedGroup> groups = new ArrayList<FeedGroup>();

	public ControlMessage(String rawMessage) {

		Gson gson = new Gson();
		JsonObject message = new JsonParser().parse(rawMessage).getAsJsonObject();
		
		this.command = message.get("command").getAsString();
		JsonObject data = message.get("data").getAsJsonObject();
		JsonObject settings = data.get("settings").getAsJsonObject();

		// Parse JSON into Groups and Feed urls
		JsonArray groupsJson = data.getAsJsonArray("groups");
		
		for(final JsonElement groupJson : groupsJson) {

			FeedGroup group = gson.fromJson(groupJson.toString(), FeedGroup.class);
			group.updateId(); // manually set id because gson
			groups.add(group);
		}

		// Provide a list of accepted RSS entry dates based on date option
		String dateOption = settings.get("date").getAsString();
		
		switch (dateOption){
			case "week":
				this.rejectDate = LocalDate.now().minusDays(8); // previous week
				break;
			case "2days":
				this.rejectDate = LocalDate.now().minusDays(3); // 3 days+ ago
				break;
			default:
				this.rejectDate = LocalDate.now().minusDays(1); // yesterday
				break;
		}
	}

	public List<FeedGroup> getGroups() {
		return groups;
	}

	public LocalDate getRejectDate() {
		return rejectDate;
	}

	public String getCommand() {
		return command;
	}


	@Override
	public String toString() {
		return "Message: [command=" + command + "]";
	}

}