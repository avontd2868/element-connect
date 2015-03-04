/**
 * Datalist controller for selecting the fields.
 *
 *
 * @author Ramana
 */

var DatalistController = BaseController.extend({

    _notifications: null,
    _cloudElementsUtils: null,
    _picker: null,
    _datalist: null,
    _instances: null,

    init:function($scope, CloudElementsUtils, Picker, Datalist, Notifications, $window, $location, $filter, $route){
        var me = this;

        me._notifications = Notifications;
        me._cloudElementsUtils = CloudElementsUtils;
        me._picker = Picker;
        me._datalist = Datalist;
        me.$window = $window;
        me.$location = $location;
        me._super($scope);
    },

    defineScope:function() {
        var me = this;

        me.$scope.instanceObjects = [];
        me.$scope.selectedObject = {};
        me.$scope.objectMetaData = [];
        me.$scope.cbObject = {
            checked: false
        };

        //Mapping of UI actions to methods to be invoked
        me.$scope.refreshObjectMetaData = me.refreshObjectMetaData.bind(this);

        // Handling Booleans to display and hide UI
        me.$scope.showTree = false;

        //Handling Action Methods
        me.$scope.save = me.save.bind(this);
        me.$scope.cancel = me.cancel.bind(this);

        me.$scope.checkAllInstance = me.checkAllInstance.bind(this);
        me.$scope.unCheckObject = me.unCheckObject.bind(this);
        me._seedDatalist();
    },

    defineListeners:function(){
        var me = this;
        me._super();

        //Needed this for back and forth between datalist and Picker, if the datalist is reinitializes every time, this is not required
        me._notifications.addEventListener(bulkloader.events.VIEW_CHANGE_DATALIST, me._seedDatalist.bind(me));

        me._notifications.addEventListener(bulkloader.events.TRANSFORMATION_SAVED, me._onTransformationSave.bind(me));
        me._notifications.addEventListener(bulkloader.events.DATALIST_ERROR, me._onDatalistError.bind(me));

    },

    refreshObjectMetaData: function() {
        var me = this;

        var instanceMeta = me._datalist.all[me._picker.selectedElementInstance.element.key].metadata;
        if(me._cloudElementsUtils.isEmpty(instanceMeta)
            || me._cloudElementsUtils.isEmpty(instanceMeta[me.$scope.selectedObject.select])) {

            me._datalist.loadObjectMetaData(me._picker.selectedElementInstance, me.$scope.selectedObject.select)
                .then(me._handleOnMetadataLoad.bind(me, me.$scope.selectedObject.select));
        } else {
            me._handleOnMetadataLoad(me.$scope.selectedObject.select, instanceMeta[me.$scope.selectedObject.select]);
        }
    },

    _handleOnMetadataLoad: function(objectname,data) {
        var me = this;
        me.$scope.objectMetaData = data.fields;
        me.$scope.selectedObject.select = objectname;
        me.$scope.showTree = true;
    },

    _seedDatalist: function() {
        var me = this;

        if(me._cloudElementsUtils.isEmpty(me._picker.selectedElementInstance)) {
            me.$location.path('/');
            return;
        }

        //Load the objects for the element
        me._datalist.loadInstanceObjects(me._picker.selectedElementInstance)
            .then(me._handleOnInstanceObjectsLoad.bind(me));
    },

    _handleOnInstanceObjectsLoad: function(data) {
        var me = this;
        me.$scope.instanceObjects = data;
    },

    cancel: function() {
        var me = this;
        me.$location.path('/');
    },

    save: function() {
        var me = this;
        me._datalist.saveDefinitionAndTransformation(me._picker.selectedElementInstance);
    },

    _onTransformationSave: function() {
        //TODO Show the scheduler

        console.log('Saved');
    },

    _onDatalistError: function() {
        var me = this;
    },

    checkAllInstance: function(cbState) {
        var me = this;
        for (var i = 0; i < me.$scope.objectMetaData.length; i++) {
            me.$scope.objectMetaData[i].transform = cbState;
        }
    },

    unCheckObject: function(cbState){
        var me = this;
        if (cbState == false){
            me.$scope.cbObject.checked = false;
        }
    }
});

DatalistController.$inject = ['$scope','CloudElementsUtils','Picker', 'Datalist', 'Notifications', '$window', '$location', '$filter', '$route'];


angular.module('bulkloaderApp')
    .controller('DatalistController', DatalistController);