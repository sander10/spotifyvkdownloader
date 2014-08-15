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

// Content script
// It fetches song list from Spotify Web player

// Returns songs as array
function getSongs() {
   var songs = [];
   var $iframe = jQuery("div.front iframe");
   if ($iframe.length == 0) {
      $iframe = jQuery("div.root iframe").last();
   }
   var $rows = $iframe.contents().find("tr.tl-row");
   var albumArtist = $iframe.contents().find("div.header-bar").find("a[data-uri^='spotify:artist']").text();
   if ($rows.length) {
      // Playlist context
      $rows.each(function () {
         // Removes excessive whitespace from string
         function filterWhitespace(string) {
            return string.trim().replace(/(\r\n|\n|\r|↵)/gm, " ").replace(/ +/g, " ");
         }

         var $row = $(this);
         var title = filterWhitespace($row.find("td.tl-name").text());
         var artist = filterWhitespace($row.find("td.tl-artists").text());
         if (title == "") {
            title = filterWhitespace($row.find("td.tl-name-with-featured").text());
         }
         if (artist == "") {
            artist = albumArtist;
         }
         if (!(title == "" || artist == "")) {
            songs.push({
               "title": title,
               "artist": artist
            });
         }
      });
   }
   return songs;
}

// Handles messages from main script
chrome.runtime.onMessage.addListener(
   function (request, sender, sendResponseCallback) {
      var response = {};
      switch (request.command) {
         case "get_songs":
            var songs = getSongs();
            response["songs"] = songs;
            break;
         case "download_songs":
            break;
      }
      sendResponseCallback(response);
   }
);
