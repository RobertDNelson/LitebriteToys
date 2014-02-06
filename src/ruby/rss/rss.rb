require 'feedzirra'
require 'rest-client'
require 'json'

SERVER = "http://10.1.3.251/litebrite/peggy"#2/"
LEASE_DURATION = 1
strib_feed_url = "http://www.startribune.com/rss/?sf=1&s=/"
feed = Feedzirra::Feed.fetch_and_parse(strib_feed_url)

loop do 
	feed = Feedzirra::Feed.update(feed)

	lease = nil
	result = nil
	while result != "success"
		sleep (15) unless result.nil?
		lease_response = RestClient.get "#{SERVER}/get_lease/#{LEASE_DURATION}"
		lease = JSON.parse(lease_response.to_str)
		puts lease
		result = lease["result"]
	end

	token = lease["lease_code"]

	6.times do |i|
		RestClient.get "#{SERVER}/write/#{token}/#{i}/0/#{URI.escape(" "*150)}"
	end



	RestClient.get "#{SERVER}/write/#{token}/0/0/#{URI.escape("___________STAR TRIBUNE HEADLINES___________")}"
	5.times do |i|
		entry = feed.entries[i]
		RestClient.get "#{SERVER}/write/#{token}/#{i+1}/0/#{URI.escape(entry.title[0...150])}"
	end

	RestClient.get "#{SERVER}/2/expire_lease/#{token}"	
	sleep(60*10)
end


