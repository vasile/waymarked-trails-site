lg = console.log;
API_URL = '/api';
MEDIA_URL = 'http://marama/wmt-static';

Osgende = {}

Osgende.BaseMapControl = function() {
  var obj = {};

  function map_move_end(evt) {
    var view = evt.map.getView();
    var zoom = view.getZoom()
    var center = ol.proj.transform(view.getCenter(), "EPSG:3857", "EPSG:4326");
    var map_param = "map=" + zoom + '!' +
                    (Math.round(center[1] * 10000) / 10000) + '!' +
                    (Math.round(center[0] * 10000) / 10000);

    var h = window.location.hash || '#';
    if (h.indexOf('?') < 0)
        h = h + '?' + map_param;
    else if (h.indexOf('map=') >= 0)
        h = h.replace(new RegExp("map=[^&]*"), map_param);
    else
        h = h + '&' + map_param;

    window.history.replaceState(window.history.state, document.title, h);

    if (Modernizr.localstorage) {
      localStorage.setItem('location',
                           JSON.stringify({ center: center, zoom: zoom}));
    }
  }

  var init_view = { center: [8.6517, 46.6447], zoom: 11 };
  if (Modernizr.localstorage && localStorage.getItem('location') !== null) {
    init_view = JSON.parse(localStorage.getItem('location'));
  }

  var url_view = decodeURI(window.location.hash.replace(
               new RegExp("^(?:.*[&\\?]map(?:\\=([^&]*))?)?.*$", "i"), "$1"));
  if (url_view) {
    var parts = url_view.split('!');
    if (parts.length === 3) {
      init_view = { zoom : parseInt(parts[0], 10),
                    center : [parseFloat(parts[2]), parseFloat(parts[1])] };
    }
  }

  obj.map = new ol.Map({
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      })
    ],
    controls: ol.control.defaults({ attribution: false }),
    target: 'map',
    view: new ol.View({ center: ol.proj.transform(init_view.center, "EPSG:4326", "EPSG:3857"),
                      zoom: init_view.zoom })
  });

  obj.map.on('moveend', map_move_end);

  return obj;
}

Osgende.RouteList = function(map, container) {
  var obj = {};

  $("div:first-child", container)
    .on("panelopen", function() {
      update_list();
      map.on('moveend', update_list);
    })
    .on("panelclose", function() { map.un('moveend', update_list); });

  function update_list() {
    var extent = map.getView().calculateExtent(map.getSize());
    $.getJSON(API_URL + "/list/by-area", {bbox: extent.join()})
       .done(rebuild_list)
       .fail(function( jqxhr, textStatus, error ) {
          var err = textStatus + ", " + error;
          console.log( "Request Failed: " + err );
        });
  }


  function rebuild_list(data) {
    var obj_list = $(".ui-listview", container);
    obj_list.empty();
    var rels = data['relations'];
    for (var i = 0; i < rels.length; i++) {
        var r = rels[i];
        var o = $(document.createElement("a"))
                  .attr({ href : '#route?id=' + r.id })
                  .data({ routeId : r.id });

        o.append($(document.createElement("img"))
                   .attr({ src : data.symbol_url + r.symbol,
                           'class' : 'ui-li-icon'}));
        o.append($(document.createElement("h3")).text(r.name));
        if (r.name != r.local_name)
          o.append($(document.createElement("p")).text(r.local_name));
        obj_list.append($(document.createElement("li"))
                         .attr({ 'data-icon' : false,
                                 'data-importance' : r.importance})
                         .append(o));
    }
    $("a", obj_list[0]).on("click", function(event) {
        event.preventDefault();
        $.mobile.navigate("#route?id=" + $(this).data("routeId"));
    });
    $(obj_list).listview({autodividers : true,
                          autodividersSelector : function(ele) {
                            var imp = $(ele).data("importance");
                            if (imp < 10)
                              return 'international';
                            else if (imp < 20)
                              return 'national'
                            else if (imp < 30)
                              return 'regional';
                            else
                              return 'local';
    }}).listview("refresh");
  }


  return obj;
}

Osgende.RouteDetails = function(map, container) {
  var obj = {};

  $("div:first-child", container)
    .on("panelbeforeopen", function() {
       var rid = decodeURI(window.location.hash.replace(
               new RegExp("^(?:.*[&\\?]id(?:\\=([^&]*))?)?.*$", "i"), "$1"));
       if (rid)
           load_route(rid);
    });

  function load_route(id) {
    $(".browser.content", container).html("Info");
    $(".sidebar-content", container).hide();
    $.mobile.loader("show");
    $.getJSON(API_URL + "/relation", {oid: id})
       .done(rebuild_form)
       .fail(function( jqxhr, textStatus, error ) {
          var err = textStatus + ", " + error;
          $(".sidebar-error", container)
            .html(err)
            .show();
        })
       .always(function() { $.mobile.loader("hide"); });
  }

  function rebuild_form(data) {
    $("[data-field]", container).empty();
    for (var k in data) {
      $('[data-field="' + k + '"]', container).html(data[k]);
    }
    $(".sidebar-data", container).show();
  }

  return obj;
}

$(function() {

  $("[data-role='header'], [data-role='footer']").toolbar();
  $("[data-role='footer-controlgroup']").controlgroup();
  $(".sidebar-loader").loader({ defaults: true });

  $(":mobile-pagecontainer").on("pagecontainershow", function(event, ui) {
    $(".ui-panel", ui.toPage).panel("open");
  });

  $("#api-last-update").load(API_URL + "/last-update");

  $("#searchform").on("submit", function(event) {
    $.mobile.navigate('#search?' + $(this).serialize());
    event.preventDefault();
  });

  $("#search-panel").on("open", function(event, ui) {
  });

  var base = Osgende.BaseMapControl();
  var routelist = Osgende.RouteList(base.map, $("#routelist")[0]);
  var routedetails = Osgende.RouteDetails(base.map, $("#routes")[0]);
});

