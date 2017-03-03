package tipech.thesis.extraction;

import java.util.ArrayList;
import java.util.List;

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
	// final String date;
	// final String dataRate;
	// final String rssRate;

	final List<Group> groups = new ArrayList<Group>();

	public ControlMessage(String json) {

		Gson gson = new Gson();
		JsonObject message = new JsonParser().parse(json).getAsJsonObject();
		
		this.command = message.get("command").getAsString();

		JsonObject data = message.get("data").getAsJsonObject();

		// Parse JSON into Groups and Feed urls
		JsonArray groupsJson = data.getAsJsonArray("groups");
		
		for(final JsonElement groupJson : groupsJson) {

			Group group = gson.fromJson(groupJson.toString(), Group.class);
			groups.add(group);
		}
	}

	public List<Group> getGroups() {
		return groups;
	}

	public String getCommand() {
		return command;
	}


	@Override
	public String toString() {
		return "Message: [command=" + command + "]";
	}

}