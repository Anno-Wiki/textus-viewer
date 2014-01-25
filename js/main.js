require.config({
  /*
   * Using the forked versions of Backbone and Underscore which support async modules - this is
   * arguably a mistake, while in theory it's the right way to do things there's quite a lot which
   * is glitchy
   */
  paths : {
    text : '../vendor/require.text-2.0.1',
    templates : '../templates'
  },
  shim : {

  }
});

// Hold the currently running activity, or null if there isn't one.
var _currentActivity = null;
// Hold the current URL fragment set by the router, this is used to
// restore the appropriate URL when an activity vetoes a stop
// request.
var _currentFragment = null;
var _listenersToUnbind = null;
// Start a new activity, attempting to stop the previously running
// one if applicable. If the previous activity vetoes shutdown
// nothing happens.

Form = Backbone.Form;

require([ 'activities/readTextActivity', 'models' ],
    function(ReadTextActivity, models) {

  /* Configure the Form layout to use bootstrap CSS */
  Form.setTemplates({
    form : '<form class="form-horizontal">{{fieldsets}}</form>',
    fieldset : '<fieldset><legend>{{legend}}</legend>{{fields}}</fieldset>',
    field : '<div class="control-group"><label class="control-label" for="{{id}}">'
        + '{{title}}</label><div class="controls"><div class="input-xlarge">'
        + '{{editor}}</div></div></div>',
    nestedField : '<div><div title="{{title}}" class="input-xlarge">{{editor}}</div>'
        + '<div class="help-block">{{help}}</div></div>',
    list : '<div class="bbf-list"><ul class="unstyled clearfix">{{items}}</ul>'
        + '<button class="bbf-add" data-action="add">Add</div></div>',
    listItem : '<li class="clearfix"><div class="pull-left">{{editor}}</div>'
        + '<button class="bbf-del" data-action="remove">x</button></li>',
    date : '<div class="bbf-date"><select data-type="date" class="bbf-date">'
        + '{{dates}}</select><select data-type="month" class="bbf-month">'
        + '{{months}}</select><select data-type="year" class="bbf-year">' + '{{years}}</select></div>',
    dateTime : '<div class="bbf-datetime"><p>{{date}}</p>'
        + '<p><select data-type="hour" style="width: 4em">{{hours}}</select>'
        + ':<select data-type="min" style="width: 4em">{{mins}}</select></p></div>',
    'list.Modal' : '<div class="bbf-list-modal">{{summary}}</div>'
  }, {
    error : 'error'
  });
  /*
   * Extend a close() operation to all views to help remove potential zombie listeners and
   * elements. Code and general method / help from
   * http://lostechies.com/derickbailey/2011/09/15/zombies-run-managing-page-transitions-in-backbone-apps/
   */
  Backbone.View.prototype.close = function() {
    this.remove();
    this.unbind();
    if (this.onClose) {
      this.onClose();
    }
  };

  /**
   * Router defined here, add client-side routes here to handle additional pages and
   * manage history sensibly.
   */
  var TextusRouter = Backbone.Router.extend({
      routes : {
        'text/:textId/:offset' : 'text',
        'texts' : 'texts',
        'meta/:textId' : 'textMeta',
        '*actions' : 'defaultActions'
      },

      text : function(textId, offset) {
        this.startActivity(new ReadTextActivity(), {
          textId : textId,
          offset : parseInt(offset),
          router : appRouter
        });
      },

      defaultActions : function() {
        this.startActivity(new ReadTextActivity(), {
          textId : 1,
          offset : 0,
          router : appRouter
        });
      }
  });
  var appRouter = new TextusRouter();

  appRouter.startActivity = function(activity, location) {
    var activityName = (activity.hasOwnProperty('name') ? activity.name : "<unknown activity>");
    if (_currentActivity != null) {
      var currentActivityName = (_currentActivity.hasOwnProperty('name') ? _currentActivity.name
          : "<unknown activity>");
      console.log("Requesting that activity '" + currentActivityName + "' stop on transition to '"
          + Backbone.history.fragment + "'");
      _currentActivity.stop(function(stopAllowed) {
        if (!stopAllowed) {
          console.log("Activity '" + currentActivityName + "' vetoed stop request!");
          if (_currentFragment != null) {
            appRouter.navigate(_currentFragment, {
              trigger : false,
              replace : false
            });
          }
          // Do nothing, the action vetoed stopping! Here is
          // where we'd reset the displayed URL to that for
          // the previous activity which is still running.
        } else {
          console.log("Activity '" + currentActivityName + "' accepted stop request.");
          // Clean up any model listeners returned by the activity
          if (_listenersToUnbind) {
            _listenersToUnbind.forEach(function(l) {
              console.log("Cleaning up listener registration " + l);
              l.model.unbind(l.event, l.handler);
            });
          }
          // The activity has stopped, done any required
          // cleanup etc. We can set currentActivity to null
          // and call this function again.
          _currentActivity = null;
          // Retrieve the current user from the server, then start the new
          // activity.
          startActivity(activity, location);
        }
      });
    }
    if (_currentActivity == null) {
      $('#main-nav').children().removeClass('active');
      $('#main-nav li#' + activity.name).addClass('active');
      _currentActivity = activity;
      _currentFragment = Backbone.history.fragment;
      if (activity.pageTitle) {
        $('#main-title').html(activity.pageTitle);
        window.document.title = "Textus - " + activity.pageTitle;
      } else {
        $('#main-title').html("No title");
        window.document.title = "Textus Beta";
      }

      // TODO: set current user properly - loginClient is now removed
      // loginClient.getCurrentUser(function() {
        $('#main').empty();
        if (location != null) {
          console.log("Starting activity '" + activityName + "' with location '" + location + "'");
          _listenersToUnbind = activity.start(location);
        } else {
          console.log("Starting activity '" + activityName + "' with no location.");
          _listenersToUnbind = activity.start();
        }
      // });
    }
  };

  /* Initialise the router, starting the application */
  Backbone.history.start();
});
