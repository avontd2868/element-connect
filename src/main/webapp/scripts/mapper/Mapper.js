/**
 * Datalist factor class as an helper to picker controller.
 *
 *
 * @author Ramana
 */

bulkloader.events.TRANSFORMATION_SAVED = "Datalist.TRANSFORMATION_SAVED";
bulkloader.events.DATALIST_ERROR = "Datalist.ERROR";

var Mapper = Class.extend({
    _elementsService:null,
    _notifications: null,
    _cloudElementsUtils: null,
    _picker: null,
    _objectMetadata: null,
    _objectMetadataFlat: null,

    //An Object which holds all the data at instance Level
    all: new Object,

    _handleLoadError:function(error){
        //Ignore as these can be ignored or 404's
        console.log('Loading error' + error);
    },

    _isLiteral: function(type) {
        if(type == 'string' || type == 'number'
            || type == 'date' || type == 'boolean'
            || type == 'unknown' || type == null
            || this._isDateFormat(type)
            || this._isLiteralArray(type))
        {
            return true;
        }

        return false;
    },

    _isLiteralArray: function(type) {
        if(type == 'array[string]' || type == 'array[number]'
            || type == 'array[boolean]')
        {
            return true;
        }

        return false;
    },

    _isDateFormat: function(type) {
        if(type == "yyyy-MM-dd'T'HH:mm:ssXXX"
            || type == "yyyy-MM-dd"
            || type == "MM/dd/yyy'T'HH:mm:ssXXX"
            || type == "MM/dd/yyy"
            || type == "dd/MM/yyy'T'HH:mm:ssXXX"
            || type ==  "dd/MM/yyy"
            || type ==  "milliseconds"
            || type ==  "Vendor date format")
        {
            return true;
        }
        return false;
    },

    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    // Load selected Instance Objects
    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    loadInstanceObjects:function(selectedInstance, targetInstance){
        var me = this;

        var selectedInstance = angular.fromJson(selectedInstance);
        var targetInstance = angular.fromJson(targetInstance);

        if(me._cloudElementsUtils.isEmpty(me.all[selectedInstance.element.key])) {
            me.all[selectedInstance.element.key] = new Object;
            me.all[selectedInstance.element.key].instance = selectedInstance;
        }

        if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key])) {
            me.all[targetInstance.element.key] = new Object;
            me.all[targetInstance.element.key].instance = targetInstance;
        }

        me.loadInstanceDefinitions(selectedInstance);

        //Check if the target instance objects needs to be loaded based on configuration
        //If Objects are present in target config, just use that if not load it from server
        if(me._cloudElementsUtils.isEmpty(me._picker._target)
            || me._cloudElementsUtils.isEmpty(me._picker._target.objects)) {
            //loading the target Instance Objects
            me._elementsService.loadInstanceObjects(targetInstance)
                .then(
                me._handleLoadTargetInstanceObjects.bind(this, targetInstance),
                me._handleLoadInstanceObjectError.bind(this));
        } else {
            me._loadTargetInstanceObjectsFromConfig(me._picker._target, targetInstance);
        }

        return me.loadInstanceTransformations(selectedInstance);
    },

    _handleLoadInstanceObjects:function(selectedInstance, result) {
        var me = this;

        me.all[selectedInstance.element.key].objects = result.data;

        if(me.all[selectedInstance.element.key].objects ==  null ||
            me.all[selectedInstance.element.key].objects.length == 0) {

            var sourceElement = me._picker.getSourceElement(selectedInstance.element.key);

            if(!me._cloudElementsUtils.isEmpty(sourceElement.objects)) {
                var objects = new Array();
                for(var i in sourceElement.objects) {
                    var obj = sourceElement.objects[i];
                    objects.push(obj.vendorPath);

                    if(me._cloudElementsUtils.isEmpty(me.all[selectedInstance.element.key].metadata)) {
                        me.all[selectedInstance.element.key].metadata = new Object;
                        me.all[selectedInstance.element.key].metadataflat = new Object;
                    }

                    var objectMetadata = obj;
                    var objectMetadataFlat = new Object;

                    angular.extend(objectMetadata, objectMetadataFlat);
                    me.all[selectedInstance.element.key].metadataflat[obj.vendorPath] = objectMetadataFlat;

                    me._restructureObjectMetadata(objectMetadata, 'path');
                    me.all[selectedInstance.element.key].metadata[obj.vendorPath] = objectMetadata;
                }

                me.all[selectedInstance.element.key].objects = objects;
                result.data = objects;
            }
        }

        var objectsAndTransformation = new Array();
        if(!me._cloudElementsUtils.isEmpty(result.data)) {
            for(var i=0; i< result.data.length; i++) {
                var objName = result.data[i];
                var obj = {
                    name: objName
                };
                obj = me._findAndUpdateTransformation(obj, objName, selectedInstance)
                objectsAndTransformation.push(obj);
            }
        }
        me.all[selectedInstance.element.key].objectsAndTransformation = objectsAndTransformation;

        return me.all[selectedInstance.element.key].objectsAndTransformation;
    },

    _loadTargetInstanceObjectsFromConfig: function(target, targetInstance) {
        var me = this;
        if(me._cloudElementsUtils.isEmpty(me._picker._target.objects)) {
            return;
        }

        var objects = new Array();
        for(var i in me._picker._target.objects) {
            var obj = me._picker._target.objects[i]
            objects.push(obj.vendorPath);

            if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key].metadata)) {
                me.all[targetInstance.element.key].metadata = new Object;
                me.all[targetInstance.element.key].metadataflat = new Object;
            }

            var objectMetadata = obj;
            var objectMetadataFlat = new Object;

            angular.extend(objectMetadata, objectMetadataFlat);
            me.all[targetInstance.element.key].metadataflat[obj.vendorPath] = objectMetadataFlat;

            me._restructureObjectMetadata(objectMetadata);
            me.all[targetInstance.element.key].metadata[obj.vendorPath] = objectMetadata;
        }

        me.all[targetInstance.element.key].objects = objects;
    },

    _handleLoadTargetInstanceObjects:function(targetInstance, result){
        var me = this;

        me.all[targetInstance.element.key].objects = result.data;
    },

    _findAndUpdateTransformation: function(obj, objectName, selectedInstance) {
        var me = this;

        var trans = me.all[selectedInstance.element.key].transformations;
        if(me._cloudElementsUtils.isEmpty(trans)) {
            return obj;
        }

        var transformationKeys = Object.keys(trans);
        var transformedObject = null;
        var targetObject  = null;

        for(var i=0; i< transformationKeys.length; i++) {
            targetObject = transformationKeys[i];
            transformedObject = trans[targetObject];
            if(transformedObject.vendorName == objectName) {
                obj.vendorName = targetObject;
                obj.transformed = true;
                break;
            }
            else {
                transformedObject = null;
            }
        }

        return obj;
    },

    _handleLoadInstanceObjectError: function(result) {
        return "Error getting the discovery object";
    },

    //Based on the selected instance get all the object transformation
    loadInstanceTransformations: function(selectedInstance) {
        return this._elementsService.loadInstanceTransformations(selectedInstance)
            .then(
            this._handleLoadInstanceTransformations.bind(this, selectedInstance),
            this._handleLoadInstanceTransformationsError.bind(this, selectedInstance) );
    },

    _handleLoadInstanceTransformationsError:function(selectedInstance,result){
        var me = this;
        me.all[selectedInstance.element.key].transformationsLoaded = true;
        return me._loadObjects(selectedInstance);
    },

    _handleLoadInstanceTransformations:function(selectedInstance, result){
        var me = this;
        me.all[selectedInstance.element.key].transformationsLoaded = true;
        me.all[selectedInstance.element.key].transformations = result.data;
        return me._loadObjects(selectedInstance);
    },

    _loadObjects: function(selectedInstance) {
        return this._elementsService.loadInstanceObjects(selectedInstance)
            .then(
            this._handleLoadInstanceObjects.bind(this, selectedInstance),
            this._handleLoadInstanceObjectError.bind(this));
    },

    //Based on the selected instance get all the instance definitions
    loadInstanceDefinitions: function(selectedInstance) {
        this._elementsService.loadInstanceObjectDefinitions(selectedInstance)
            .then(
            this._handleLoadInstanceDefinitions.bind(this, selectedInstance),
            this._handleLoadError.bind(this) );

    },

    _handleLoadInstanceDefinitions:function(selectedInstance, result){
        var me = this;
        me.all[selectedInstance.element.key].definitions = result.data;
    },

    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    // Load selected Object metadata
    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    loadObjectMetaData:function(selectedInstance, selectedObject){

        return this._elementsService.loadObjectMetaData(selectedInstance, selectedObject)
            .then(
            this._handleLoadObjectMetadata.bind(this, selectedInstance, selectedObject),
            this._handleLoadErrorObjectMetadata.bind(this) );
    },

    _handleLoadErrorObjectMetadata: function(result) {
        return "Error getting the discovery object";
    },

    _handleLoadObjectMetadata:function(selectedInstance, selectedObject, result){
        var me = this;

        if(me._cloudElementsUtils.isEmpty(me.all[selectedInstance.element.key].metadata)) {
            me.all[selectedInstance.element.key].metadata = new Object;
            me.all[selectedInstance.element.key].metadataflat = new Object;
        }

        var objectMetadata = result.data;
        var objectMetadataFlat = new Object;

        angular.extend(objectMetadata, objectMetadataFlat);
        me.all[selectedInstance.element.key].metadataflat[selectedObject] = objectMetadataFlat;

        me._restructureObjectMetadata(objectMetadata, 'path');
        me.all[selectedInstance.element.key].metadata[selectedObject] = objectMetadata;

        return objectMetadata;
    },

    loadObjectMapping: function(selectedInstance, selectedObject, targetInstance, objectMetadata) {
        var me = this;

        var trans = me.all[selectedInstance.element.key].transformations;
        if(me._cloudElementsUtils.isEmpty(trans)) {
            return "";
        }

        var transformationKeys = Object.keys(trans);
        var transformedObject = null;
        var targetObject  = null;

        for(var i=0; i< transformationKeys.length; i++) {
            targetObject = transformationKeys[i];
            transformedObject = trans[targetObject];
            if(transformedObject.vendorName == selectedObject) {
                transformedObject.name = targetObject;
                break;
            }
            else {
                transformedObject = null;
            }
        }

        if(me._cloudElementsUtils.isEmpty(transformedObject)
            || me._cloudElementsUtils.isEmpty(transformedObject.fields)) {
            return null;
        }

        objectMetadata.objectTransformation = true;

        return me.loadTargetObjectMetaMapping(selectedInstance, selectedObject, targetInstance, transformedObject.name)
            .then(me._handleOnTargetEmptymappingLoad.bind(me, transformedObject));
    },

    _handleOnTargetEmptymappingLoad: function(transformedObject, emptyMapping) {

        var me = this;

        //Populate the mapping with the vendorPath from transformation
        me._populateVendorPath(emptyMapping, transformedObject);

        return emptyMapping;
    },

    _populateVendorPath: function(mapping, transformation) {
        var me = this;

        for(var i=0; i < transformation.fields.length; i++) {
            var t = transformation.fields[i];

            if(!me._cloudElementsUtils.isEmpty(t.vendorPath)){
                me._setVendorPathInMapping(mapping, t.path, t.vendorPath);
            }
        }
    },

    _setVendorPathInMapping: function(mapping, path, vendorPath, parentMap) {
        var me = this;

        var findIn = parentMap;
        if(findIn == null) {
            findIn = mapping;
        }

        if(path.indexOf('.') === -1) {

            if(!me._cloudElementsUtils.isEmpty(findIn.fields)){
                for(var i=0; i < findIn.fields.length; i++) {
                    var t = findIn.fields[i];
                    if(t.path == path) {
                        t.vendorPath = vendorPath;
                        break;
                    }
                }
            }
        }
        else {
            var fieldParts = path.split('.').slice(1).join('.');
            var objField = path.split('.')[0];

            if(!me._cloudElementsUtils.isEmpty(findIn.fields)){
                for(var i=0; i < findIn.fields.length; i++) {
                    var t = findIn.fields[i];
                    if(t.path == objField) {
                        me._setVendorPathInMapping(mapping, fieldParts, vendorPath, t);
                        break;
                    }
                }
            }
        }
    },

    _restructureObjectMetadata: function(objectMetadata, pathName) {

        if(this._cloudElementsUtils.isEmpty(objectMetadata)
            || this._cloudElementsUtils.isEmpty(objectMetadata.fields)) {
            return;
        }

        if(this._cloudElementsUtils.isEmpty(pathName)) {
            pathName = 'vendorPath';
        }

        for(var i=0; i < objectMetadata.fields.length; i++) {
            var field = objectMetadata.fields[i];

            if(field.vendorPath.indexOf('.') !== -1) {


                var fieldParts = field.vendorPath.split('.').slice(1).join('.');
                var objField = field.vendorPath.split('.')[0];

                var newInnerMetaData = this._getObjectInMetaData(objectMetadata, objField);
                if(this._cloudElementsUtils.isEmpty(newInnerMetaData)) {
                    newInnerMetaData = new Object;
                    newInnerMetaData[pathName] = objField;
                    newInnerMetaData.vendorPath = objField;
                    newInnerMetaData['fields'] = [];
                    var t = 'object';
                    if(objField.indexOf('[*]') !== -1) {
                        t = 'array';
                    }
                    newInnerMetaData['type'] = t;

                    objectMetadata.fields.push(newInnerMetaData);
                }

                if(fieldParts.indexOf('.') === -1)
                {
                    var newInnerField = angular.copy(field);
                    newInnerField.actualVendorPath = field.vendorPath;
                    newInnerField.vendorPath = null;
                    newInnerField[pathName] = fieldParts;
                    if(this._cloudElementsUtils.isEmpty(newInnerField.fields)) {
                        newInnerField.fields = [];
                    }
                    newInnerMetaData.fields.push(newInnerField);
                }
                else
                {
                    this._structureInnerObjectMetadata(newInnerMetaData, fieldParts, field, pathName);
                }
            }
            else {
                field['actualVendorPath'] = field.vendorPath;
                field.vendorPath = null;
                field[pathName] = field['actualVendorPath'];
                if(this._cloudElementsUtils.isEmpty(field.fields)) {
                    field.fields = [];
                }
            }
        }

        objectMetadata.fields = objectMetadata.fields
            .filter(function (field) {
                if(field[pathName] != null) {
                    return field[pathName].indexOf('.') === -1;
                } else {
                    return field.vendorPath.indexOf('.') === -1;
                }

            });
    },

    _getObjectInMetaData: function(metadata, objectname) {
        for(var i=0; i < metadata.fields.length; i++) {
            var field = metadata.fields[i];

            if(field.vendorPath === objectname) {
                return field;
            }
        }
    },

    _structureInnerObjectMetadata: function(metadata, fieldParts, field, pathName) {

        var innerfieldParts = fieldParts.split('.').slice(1).join('.');
        var objField = fieldParts.split('.')[0];

        var newInnerMetaData = this._getObjectInMetaData(metadata, objField);
        if(this._cloudElementsUtils.isEmpty(newInnerMetaData)) {
            newInnerMetaData = new Object;
            newInnerMetaData.vendorPath = objField;
            newInnerMetaData[pathName] = objField;
            newInnerMetaData['fields'] = [];
            var t = 'object';
            if(objField.indexOf('[*]') !== -1) {
                t = 'array';
            }
            newInnerMetaData['type'] = t;
            metadata.fields.push(newInnerMetaData);
        }

        if(innerfieldParts.indexOf('.') === -1)
        {
            var newInnerField = angular.copy(field);
            newInnerField.actualVendorPath = field.vendorPath;
            newInnerField.vendorPath = null;
            newInnerField[pathName] = innerfieldParts;
            if(this._cloudElementsUtils.isEmpty(field.fields)) {
                newInnerField.fields = [];
            }
            newInnerMetaData.fields.push(newInnerField);
        }
        else
        {
            this._structureInnerObjectMetadata(newInnerMetaData, innerfieldParts, field, pathName);
        }
    },


    loadTargetObjectMetaMapping:function(selectedInstance, selectedInstanceObject, targetInstance, selectedObject){
        var me = this;

        return me._elementsService.loadObjectMetaData(targetInstance, selectedObject)
            .then(
            me._handleTargetLoadObjectMetadata.bind(me, selectedInstance, selectedInstanceObject, targetInstance, selectedObject),
            me._handleTargetLoadErrorObjectMetadata.bind(me) );
    },

    _handleTargetLoadErrorObjectMetadata: function(result) {
        return "Error getting the discovery object";
    },

    _handleTargetLoadObjectMetadata: function(selectedInstance, selectedInstanceObject, targetInstance, selectedObject, result) {
        var me = this;

        if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key].metadata)) {
            me.all[targetInstance.element.key].metadata = new Object;
            me.all[targetInstance.element.key].metadataflat = new Object;
        }

        if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key].metamapping)) {
            me.all[targetInstance.element.key].metamapping = new Object;
        }

        var objectMetadata = result.data;
        var objectMetadataFlat = new Object;

        angular.extend(objectMetadata, objectMetadataFlat);
        me.all[targetInstance.element.key].metadataflat[selectedObject] = objectMetadataFlat;

        me._restructureObjectMetadata(objectMetadata);
        me.all[targetInstance.element.key].metadata[selectedObject] = objectMetadata;

        //Create an empty mapping, basically the definition from metadata and return it
        return me._createEmptyMapping(selectedInstance, selectedInstanceObject, targetInstance, selectedObject, objectMetadata)
    },

    _createEmptyMapping: function(selectedInstance, selectedInstanceObject, targetInstance, selectedObject, objectMetadata) {
        var me = this;

        if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key].metamapping)) {
            me.all[targetInstance.element.key].metamapping = new Object;
        }

        var newMapping = new Object;
        var name = selectedInstance.element.key+'_'+selectedInstanceObject+'_'+selectedObject;
        newMapping['name'] = name;
        newMapping['vendorName'] = selectedObject;
        newMapping['fields'] = objectMetadata.fields;
        me.all[targetInstance.element.key].metamapping[name] = newMapping;
        return newMapping;
    },

    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    // Construct and Save Definitions
    // Construct and Save transformations
    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    saveDefinitionAndTransformation: function(sourceInstance, targetInstance, objects) {
        var me = this;

        //Convert objects to map of objectName key and transformed value
        var objectsAndTrans = objects.reduce(function ( total, objects ) {
            total[ objects.name ] = objects.transformed;
            return total;
        }, {});

        me.all[targetInstance.element.key].objectsAndTrans = objectsAndTrans;

        //Construct the Object Definition and inner Object definitions
        //Save all the definitions at instance level
        me._constructAndSaveObjectDefinition(targetInstance, sourceInstance);
    },

    //Definition that will be created is always in flat structure
    _constructDefinition: function(definitionArray, objectName, mData, objDefinition) {
        var me = this;


        if(objDefinition == null) {
            objDefinition = {
                fields:[]
            };

            definitionArray[objectName]=objDefinition;
        }

        for(var i = 0; i < mData.fields.length; i++){
            var mapperData = mData.fields[i];

            if(me._cloudElementsUtils.isEmpty(mapperData.type)) {
                mapperData.type = 'string'; //this is dirty fix for setting a type value by default
            }

            if(this._isLiteral(mapperData.type.toLowerCase())
                || this._isDateFormat(mapperData.type))
            {
                var t = mapperData.type;
                var p = mapperData.path;

                if(this._isDateFormat(t)) {
                    t = 'date';
                }

                if(!this._cloudElementsUtils.isEmpty(p)) {
                    objDefinition.fields.push({
                        'path': p,
                        'type': t
                    });
                }
            }
            else{
                //This is where its of type Object so create a definition out of it
                // and also add it to the base definition
                var name = mapperData.path;
                if(me._cloudElementsUtils.isEmpty(name) || name.length == 0) {
                    name = mapperData.vendorPath
                }

                if(mapperData.type == 'array') {
                    name = name.replace('[*]', '');
                }

                me._constructDefinition(definitionArray, name, mapperData, objDefinition);

//                var t = mapperData.vendorPath;
//                var p = mapperData.path;
//                if(this._cloudElementsUtils.isEmpty(p) || p.length == 0) {
//                    p = mapperData.vendorPath
//                }
//                if(mapperData.type == 'array') {
//                    t = 'array['+mapperData.vendorPath.replace('[*]', '')+']';
//                    p = p+'[*]';
//                }
//
//                if(this._cloudElementsUtils.isEmpty(t)) {
//                    t = mapperData.actualVendorPath;
//                }
//
//                t = objectnamePre + t;
//                objDefinition.fields.push({
//                    'path': p,
//                    'type': t
//                });
            }
        }
    },

    _constructAndSaveObjectDefinition: function(selectedInstance, sourceInstance) {
        var me = this;

        var mData = me.all[selectedInstance.element.key].metamapping;
        var objectsAndTrans = me.all[selectedInstance.element.key].objectsAndTrans;

        var mKeys = Object.keys(mData);

        var definitionArray = new Object;
        for (var i = 0; i < mKeys.length; i++) {
            me._constructDefinition(definitionArray, mKeys[i], mData[mKeys[i]]);
        }

        var definitionSaveCounter = 0;

        return me._saveDefinitionFromArray(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter);
    },

    _saveDefinitionFromArray: function(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter, useMethodType) {
        var me = this;

        var keys = Object.keys(definitionArray);
        var key = keys[definitionSaveCounter];

        if(me._cloudElementsUtils.isEmpty(key))
            return;

        var methodType = 'POST';

        var defs = me.all[selectedInstance.element.key].definitions;

        if (!me._cloudElementsUtils.isEmpty(defs)
            && !me._cloudElementsUtils.isEmpty(defs[key])
            && defs[key].level == 'instance')
        {
            methodType = 'PUT';
        }

        if(!me._cloudElementsUtils.isEmpty(useMethodType)) {
            methodType = useMethodType;
        }

        definitionSaveCounter++;

        return me._elementsService.saveObjectDefinition(selectedInstance, key, definitionArray[key], 'instance', methodType)
            .then(
            me._handleOnSaveObjectDefinition.bind(this, selectedInstance, sourceInstance, definitionArray, definitionSaveCounter),
            me._handleOnSaveObjectDefinitionError.bind(this, selectedInstance, sourceInstance, definitionArray, definitionSaveCounter) );
    },

    _handleOnSaveObjectDefinitionError: function(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter, error) {
        var me = this;

        definitionSaveCounter--;

        if(error.status == 404) {
            return me._saveDefinitionFromArray(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter, 'POST');
        }
        else if(error.status == 409)
        {
            return me._saveDefinitionFromArray(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter, 'PUT');
        }
        else
        {
            this._notifications.notify(bulkloader.events.DATALIST_ERROR, error.data.message);
            return error;
        }
    },

    _handleOnSaveObjectDefinition: function(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter, result) {

        var me = this;

        var keys = Object.keys(definitionArray);

        if(me._cloudElementsUtils.isEmpty(me.all[selectedInstance.element.key].definitions)) {
            me.all[selectedInstance.element.key].definitions = new Object();
        }
        //Setting the saved definition in case used for multiple save
        var savedkey = keys[definitionSaveCounter-1];
        me.all[selectedInstance.element.key].definitions[savedkey] = definitionArray[savedkey];

        //Save transformations once all the definitions are stored
        if(definitionSaveCounter == keys.length)
        {
            return me._constructAndSaveObjectTransformation(selectedInstance, sourceInstance);
        }
        else
        {
            return me._saveDefinitionFromArray(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter);
        }
    },

    _constructDeeperTransformation: function(objectTransformation, objectMapperData, objectName) {

        var me = this;

        if(objectMapperData.type == 'array') {
            objectName = objectName+'[*]';
        }

        for(var i = 0; i < objectMapperData.fields.length; i++){
            var mapperData = objectMapperData.fields[i];
            var mapperType = mapperData.type.toLowerCase();

            if(this._isLiteral(mapperType)
                || this._isDateFormat(mapperData.type))
            {
                var p = mapperData.vendorPath;
                if(this._isLiteralArray(mapperData.type)) {
                    p = p+'[*]';
                }

                if(!me._cloudElementsUtils.isEmpty(mapperData.path)) {
                    var vp = mapperData.vendorPath;
                    if(!me._cloudElementsUtils.isEmpty(objectName)) {
                        vp = objectName+'.'+vp;
                    }

                    objectTransformation.fields.push({
                        'path': mapperData.path,
                        'vendorPath': vp
                    });
                }
            }
            else
            {
                var newObjectName = mapperData.vendorPath;
                if(!me._cloudElementsUtils.isEmpty(objectName)) {
                    newObjectName = objectName+'.'+mapperData.vendorPath;
                }
                this._constructDeeperTransformation(objectTransformation, mapperData, newObjectName);
            }
        }
    },

    _constructTransformation: function(selectedInstance, transformationArray, name, vendorName, metaData) {
        var me = this;

        var objectTransformation = {
            'vendorName':  vendorName,
            //For setting ignore unmapped, only the ones which are mapped will be returned
            'configuration':[
                {
                    "type": "passThrough",
                    "properties": {
                        "fromVendor": false,
                        "toVendor": false
                    }
                }
            ],
            fields:[]
        };
        me._constructDeeperTransformation(objectTransformation, metaData);
        transformationArray[name]=objectTransformation;
    },

    _constructAndSaveObjectTransformation: function(selectedInstance, sourceInstance) {
        var me = this;

        var mData = me.all[selectedInstance.element.key].metamapping;
        var objectsAndTrans = me.all[selectedInstance.element.key].objectsAndTrans;
        var mKeys = Object.keys(mData);

        var transformationArray = new Object;

        for (var i = 0; i < mKeys.length; i++) {
            me._constructTransformation(selectedInstance, transformationArray, mKeys[i], mData[mKeys[i]].vendorName, mData[mKeys[i]]);
        }

        var transformationSaveCounter = 0;
        return me._saveTransformationFromArray(selectedInstance, transformationArray, transformationSaveCounter);
    },

    _saveTransformationFromArray: function(selectedInstance, transformationArray, transformationSaveCounter, useMethodType) {
        var me = this;

        var keys = Object.keys(transformationArray);
        var key = keys[transformationSaveCounter];

        if(me._cloudElementsUtils.isEmpty(key))
            return;

        var methodType = 'POST';

        var trans = me.all[selectedInstance.element.key].transformations;

        if (!me._cloudElementsUtils.isEmpty(trans)
            && !me._cloudElementsUtils.isEmpty(trans[key]))
        {
            methodType = 'PUT';
        }

        if(!me._cloudElementsUtils.isEmpty(useMethodType)) {
            methodType = useMethodType;
        }

        transformationSaveCounter++;


        return me._elementsService.saveObjectTransformation(selectedInstance,
            key, transformationArray[key], 'instance', methodType)
            .then(
                this._handleOnSaveTransformation.bind(this, selectedInstance, transformationArray, transformationSaveCounter),
                this._handleOnSaveTransformationError.bind(this, selectedInstance, transformationArray, transformationSaveCounter) );
    },

    _handleOnSaveTransformationError: function(selectedInstance, transformationArray, transformationSaveCounter, error) {
        var me = this;
        transformationSaveCounter--;

        if(error.status == 404) { //in this scenario it might be a PUT, but expecting a POST, so change this and make a POST call again
            return me._saveTransformationFromArray(selectedInstance, transformationArray, transformationSaveCounter, 'POST');
        }
        else if(error.status == 409) { //In this case a transformation might have already been present so make a PUT call
            return me._saveTransformationFromArray(selectedInstance, transformationArray, transformationSaveCounter, 'PUT');
        }
        else {
            this._notifications.notify(bulkloader.events.DATALIST_ERROR, error.data.message);
            return false;
        }
    },

    _handleOnSaveTransformation: function(selectedInstance, transformationArray, transformationSaveCounter, result) {
        var me = this;

        var keys = Object.keys(transformationArray);
        //Save transformations once all the definitions are stored
        if(transformationSaveCounter == keys.length)
        {
            this._notifications.notify(bulkloader.events.TRANSFORMATION_SAVED);
            //return true;
        }
        else
        {
            return me._saveTransformationFromArray(selectedInstance, transformationArray, transformationSaveCounter);
        }
    }


});


/**
 * Picker Factory object creation
 *
 */
(function (){

    var MapperObject = Class.extend({

        instance: new Mapper(),

        /**
         * Initialize and configure
         */
        $get:['CloudElementsUtils', 'ElementsService','Notifications', 'Picker',function(CloudElementsUtils, ElementsService, Notifications, Picker){
            this.instance._cloudElementsUtils = CloudElementsUtils;
            this.instance._elementsService = ElementsService;
            this.instance._notifications = Notifications;
            this.instance._picker = Picker;
            return this.instance;
        }]
    });

    angular.module('bulkloaderApp')
        .provider('Mapper',MapperObject);
}());
