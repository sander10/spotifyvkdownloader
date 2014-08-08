/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Vladimir Fesko
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// Main page script
var $messagePanel = jQuery("#message_panel").hide();
var $message = jQuery("#message");
var $actionsPanel = jQuery("#actions_panel").hide();
var $actionButton = jQuery("#action_button");
var $loginToVkPanel = jQuery("#login_to_vk_panel").hide();
var $songListPanel = jQuery("#song_list_panel").hide();
var $songList = jQuery("#song_list").find("tbody");
var g_numActiveDownloads = 0;
var g_maxActiveDownloads = 4;
var g_isSearchActive = false;
var g_downloadSongIntervalMs = 1000;
var g_downloadList = [];
var g_urlToSong = {};

checkVkLoginAndLookForSongs();

// Utility checkbox
$checkAllCheckbox = jQuery("#check_all");
$checkAllCheckbox.prop("checked", "checked");
$checkAllCheckbox.click(function(){
  $songList.find("input[type=checkbox]").each(function(){
     var $checkbox = jQuery(this);
     $checkbox.prop('checked', $checkAllCheckbox.prop("checked"));
  });
});

// And close button
$closeButon = jQuery("#close_button");
$closeButon.click(function(){
   window.close();
});

// Downloads songs checked by checkboxes
function downloadSongs() {
   $songList.find("tr").each(function(){
      var $row = jQuery(this);
      var $checkbox = $row.find("input[type=checkbox]");
      if ($checkbox.prop('checked')) {
         var song = JSON.parse($checkbox.prop("data-song"));
         song["row"] = $row;
         g_downloadList.push(song);
      }
   });
   downloadSongsCycle();
}

// Main download cycle
function downloadSongsCycle() {
   if (g_numActiveDownloads >= g_maxActiveDownloads || g_isSearchActive) {
      // Update active downloads number
      setTimeout(function(){
            chrome.downloads.search({state: "in_progress"}, function(di){g_numActiveDownloads = di.length});
         },
         g_downloadSongIntervalMs / 2
      );
      // Call download cycle again
      setTimeout(function(){downloadSongsCycle()}, g_downloadSongIntervalMs);
      return;
   }
   // All songs downloaded
   if (g_downloadList.length < 1) {
      return;
   }
   g_numActiveDownloads++;
   var song = g_downloadList.splice(0, 1)[0];
   downloadSong(song);
}

// Downloads song - searches for it in vk.com
function downloadSong(song) {
   g_isSearchActive = true;
   song["row"].css('color', 'blue');
   jQuery.get(
      "http://vk.com/search?c%5Bq%5D=" + encodeURIComponent(getFullSongName(song)) + "&c%5Bsection%5D=audio",
      function(vkSearchPageHtml) {
         g_isSearchActive = false;
         var html = jQuery.parseHTML(vkSearchPageHtml);
         var $content = jQuery("<div></div>");
         $content.append(html);
         var result = $content.find("#results").find("input[type=hidden]").first().attr("value");
         var songUrl = undefined;
         if (result != undefined) {
            songUrl = result.split("?")[0];
         }
         $content.empty();
         if (songUrl != undefined) {
            songUrl += "?extra";
            song["row"].css('color', 'green');
            downloadSongFromUrl(song, songUrl);
         } else {
            song["row"].css('color', 'gray');
         }
         // Launch next download cycle after some cooldown
         setTimeout(function(){downloadSongsCycle()}, g_downloadSongIntervalMs);
      }
   );
}

// Returns full song name like "artist - title"
function getFullSongName(song) {
   return song["artist"] + " - " + song["title"];
}

// Starts download from url
function downloadSongFromUrl(song, songUrl) {
   g_urlToSong[songUrl] = song;
   chrome.downloads.download(
      {url: songUrl},
      function (downloadId) {}
   );
}

// Suggests file name when saving song
chrome.downloads.onDeterminingFilename.addListener(function (item, __suggest) {
   function suggest(filename, conflictAction) {
      __suggest({filename: filename,
         conflictAction: conflictAction,
         conflict_action: conflictAction});
      // conflict_action was renamed to conflictAction in
      // http://src.chromium.org/viewvc/chrome?view=rev&revision=214133
      // which was first picked up in branch 1580.
   }

   var filename = item.filename;
   if (item.url in g_urlToSong) {
      var song = g_urlToSong[item.url];
      var fileExt = filename.split('.').pop();
      var filenameOnly = getFullSongName(song).replace(/[\\/*?:"><|]/gm, "_");
      filename = filenameOnly + "." + fileExt;
   }

   suggest(filename, 'overwrite');
});

// Checks if logged in vk.com and looks for songs right after
function checkVkLoginAndLookForSongs() {
   ui_message("Checking vk.com login...");
   jQuery.get("http://vk.com/", function (data) {
         var html = jQuery.parseHTML(data);
         var $content = jQuery("<div></div>");
         $content.append(html);
         var $myProfile = $content.find("#myprofile_wrap").first();
         if (!$myProfile.length) {
            ui_vkLogin();
         } else {
            lookForSongs();
         }
   });
}

// Looks for songs in current context - active tab
function lookForSongs() {
   ui_message("Looking for songs...");

   // Get songs, fill the list
   sendMessageToActiveTab({command: "get_songs"}, function (response) {
      $songList.empty();
      if (response == undefined || response["songs"].length < 1) {
         ui_message("No songs found.");
         return;
      }
      var num = 0;
      response["songs"].forEach(function(song) {
         num++;
         var $url = jQuery("<td>");
         var $checkbox = jQuery("<input type='checkbox'/>");
         $checkbox.prop("data-song", JSON.stringify(song));
         $checkbox.prop("checked", "checked");
         $songList.append(
            jQuery("<tr>").append(
               jQuery("<td>").append($checkbox),
               jQuery(
                  "<td>" + num + "</td>" +
                  "<td>" + song["title"] + "</td>" +
                  "<td>" + song["artist"] + "</td>"
               ),
               $url
            )
         );

      });
      if (num > 0) {
         ui_downloadSongs();
      } else {
         ui_message("No songs found.");
      }
   });
}

// Sends ui_message to active tab
function sendMessageToActiveTab(message, responseCallback) {
   chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, message, responseCallback);
   });
}

// ui actions to display message
function ui_message(text) {
   $actionsPanel.hide();
   $loginToVkPanel.hide();
   $songListPanel.hide();
   $message.text(text);
   $messagePanel.show();
}

// ui actions to download songs
function ui_downloadSongs() {
   $messagePanel.hide();
   $loginToVkPanel.hide();
   $actionButton.text("Download songs");
   $actionButton.click(downloadSongs);
   $actionsPanel.show();
   $songListPanel.show();
}

// ui action when asking for vk.com login
function ui_vkLogin() {
   $messagePanel.hide();
   $songListPanel.hide();
   $loginToVkPanel.show();
   $actionsPanel.hide();
}
