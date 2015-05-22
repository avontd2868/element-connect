/**
 * Datalist factor class as an helper to picker controller.
 *
 *
 * @author Ramana
 */

bulkloader.events.TRANSFORMATION_SAVED = "Datalist.TRANSFORMATION_SAVED";

var Mapper = Class.extend({
    _elementsService: null,
    _notifications: null,
    _cloudElementsUtils: null,
    _picker: null,
    _objectMetadata: null,
    _objectMetadataFlat: null,

    //An Object which holds all the data at instance Level
    all: new Object,

    _handleLoadError: function(error) {
        //Ignore as these can be ignored or 404's
        console.log('Loading error' + error);
    },

    _isLiteral: function(type) {
        if(type == 'string' || type == 'number'
            || type == 'date' || type == 'boolean'
            || type == 'unknown' || type == null
            || this._isDateFormat(type)
            || this._isLiteralArray(type)) {
            return true;
        }

        return false;
    },

    _isLiteralArray: function(type) {
        if(type == 'array[string]' || type == 'array[number]'
            || type == 'array[boolean]') {
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
            || type == "dd/MM/yyy"
            || type == "milliseconds"
            || type == "Vendor date format") {
            return true;
        }
        return false;
    },

    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    // Load selected Instance Objects
    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    loadInstanceObjects: function(selectedInstance, targetInstance) {
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

        //Load target instance definitions
        me.loadInstanceDefinitions(targetInstance);

        //Load source objects
        return me._loadObjects(selectedInstance, targetInstance);
    },

    //------------------------------------------------------------------
    // Target Instance Definitions
    //------------------------------------------------------------------
    //Based on the selected instance get all the instance definitions
    loadInstanceDefinitions: function(targetInstance) {
        var me = this;

        me._elementsService.loadInstanceObjectDefinitions(targetInstance)
            .then(
            this._handleLoadInstanceDefinitions.bind(this, targetInstance),
            this._handleLoadError.bind(this));

    },

    _handleLoadInstanceDefinitions: function(targetInstance, result) {
        var me = this;
        me.all[targetInstance.element.key].definitions = result.data;
    },

    //------------------------------------------------------------------
    // Source Instance Objects
    //------------------------------------------------------------------
    _loadObjects: function(selectedInstance, targetInstance) {
        var me = this;
        var sourceElement = me._picker.getSourceElement(selectedInstance.element.key);
        if(!me._cloudElementsUtils.isEmpty(sourceElement.objects)) {
            return me._handleLoadInstanceObjects(selectedInstance, targetInstance, new Object());
        } else {
            return this._elementsService.loadInstanceObjects(selectedInstance)
                .then(
                this._handleLoadInstanceObjects.bind(this, selectedInstance, targetInstance),
                this._handleLoadInstanceObjectError.bind(this));
        }
    },

    _handleLoadInstanceObjects: function(selectedInstance, targetInstance, result) {
        var me = this;

        me.all[selectedInstance.element.key].objects = result.data;

        me.all[selectedInstance.element.key].objects = me._cloudElementsUtils.orderBy(me.all[selectedInstance.element.key].objects, 'toString()');

        if(me.all[selectedInstance.element.key].objects == null ||
            me.all[selectedInstance.element.key].objects.length == 0) {

            var sourceElement = me._picker.getSourceElement(selectedInstance.element.key);

            if(!me._cloudElementsUtils.isEmpty(sourceElement.objects)) {
                var srcObjects = new Array();
                angular.copy(sourceElement.objects, srcObjects);

                var objects = new Array();
                for(var i in srcObjects) {
                    var obj = srcObjects[i];
                    objects.push(obj.vendorPath);

                    if(!me._cloudElementsUtils.isEmpty(obj.fields) && obj.fields.length > 0) {
                        if(me._cloudElementsUtils.isEmpty(me.all[selectedInstance.element.key].metadata)) {
                            me.all[selectedInstance.element.key].metadata = new Object;
                            me.all[selectedInstance.element.key].metadataflat = new Object;
                        }

                        var objectMetadata = obj;
                        var objectMetadataFlat = new Object;

                        angular.copy(objectMetadata, objectMetadataFlat);
                        me.all[selectedInstance.element.key].metadataflat[obj.vendorPath] = objectMetadataFlat;

                        me._restructureObjectMetadata(objectMetadata, 'path');
                        me.all[selectedInstance.element.key].metadata[obj.vendorPath] = objectMetadata;
                    }
                }

                me.all[selectedInstance.element.key].objects = objects;
                result.data = objects;
            }
        }

        return me.loadInstanceTransformations(targetInstance, selectedInstance);
    },

    _handleLoadInstanceObjectError: function(result) {
        var me = this;
        me._notifications.notify(bulkloader.events.ERROR, "Error getting the discovery objects");
        //return "Error getting the discovery object";
    },

    //------------------------------------------------------------------
    // Target Instance Objects and transformations
    //------------------------------------------------------------------

    //Based on the selected instance get all the object transformation
    loadInstanceTransformations: function(targetInstance, selectedInstance) {
        return this._elementsService.loadInstanceTransformations(targetInstance, selectedInstance)
            .then(
            this._handleLoadInstanceTransformations.bind(this, targetInstance, selectedInstance),
            this._handleLoadInstanceTransformationsError.bind(this, targetInstance, selectedInstance));
    },

    _handleLoadInstanceTransformationsError: function(targetInstance, selectedInstance, result) {
        var me = this;
        me.all[targetInstance.element.key].transformationsLoaded = true;
        return me._loadTargetObjects(selectedInstance, targetInstance);
    },

    _handleLoadInstanceTransformations: function(targetInstance, selectedInstance, result) {
        var me = this;
        me.all[targetInstance.element.key].transformationsLoaded = true;
        me.all[targetInstance.element.key].transformations = result.data;
        return me._loadTargetObjects(selectedInstance, targetInstance);
    },

    _loadTargetObjects: function(selectedInstance, targetInstance) {
        var me = this;

        var targetElement = me._picker.getTargetElement(targetInstance.element.key);
        if(!me._cloudElementsUtils.isEmpty(targetElement.objects)) {
            return me._handleLoadTargetInstanceObjects(selectedInstance, targetInstance, new Object());
        } else {
            //loading the target Instance Objects
            return me._elementsService.loadInstanceObjects(targetInstance)
                .then(
                me._handleLoadTargetInstanceObjects.bind(this, selectedInstance, targetInstance),
                me._handleLoadInstanceObjectError.bind(this));
        }
    },

    _handleLoadTargetInstanceObjects: function(selectedInstance, targetInstance, result) {
        var me = this;

        me.all[targetInstance.element.key].objects = result.data;

        if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key].objects)) {
            me._loadTargetInstanceObjectsFromConfig(targetInstance);
        }

        me._findAndUpdateTransformation(targetInstance, selectedInstance);

        return me.all[selectedInstance.element.key].objectsAndTransformation;
    },

    _loadTargetInstanceObjectsFromConfig: function(targetInstance) {
        var me = this;
        var targetElement = me._picker.getTargetElement(targetInstance.element.key);
        if(me._cloudElementsUtils.isEmpty(targetElement.objects)) {
            return;
        }

        var objects = new Array();
        for(var i in targetElement.objects) {
            var obj = targetElement.objects[i];
            objects.push(obj.vendorPath);

            if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key].metadata)) {
                me.all[targetInstance.element.key].metadata = new Object;
                me.all[targetInstance.element.key].metadataflat = new Object;
            }

            var objectMetadata = obj;
            var objectMetadataFlat = new Object;

            angular.copy(objectMetadata, objectMetadataFlat);
            me.all[targetInstance.element.key].metadataflat[obj.vendorPath] = objectMetadataFlat;

            me._restructureObjectMetadata(objectMetadata);
            me.all[targetInstance.element.key].metadata[obj.vendorPath] = objectMetadata;
        }

        me.all[targetInstance.element.key].objects = objects;
    },

    _findAndUpdateTransformation: function(targetInstance, selectedInstance) {
        var me = this;

        var trans = me.all[targetInstance.element.key].transformations;
        var objectsAndTransformation = new Array();
        var tempObjectNames = new Object();

        if(!me._cloudElementsUtils.isEmpty(trans)) {
            var transformationKeys = Object.keys(trans);
            var targetObject = null;

            for(var i = 0; i < transformationKeys.length; i++) {
                targetObject = transformationKeys[i];

                //Transformations are saved in the format <source_element>_<sourceobject>_<targetobject>
                //selectedInstance.element.key+'_'+selectedInstanceObject+'_'+selectedObject;
                var selectObjectName = null;
                var srcElement = null;
                var targetObjectName = null;
                try {
                    var spl = targetObject.split('_');
                    selectObjectName = spl[1]; // Second field in the objectname is source objectname
                    targetObjectName = spl[2];
                    srcElement = spl[0];
                }
                    //Ignore the error
                catch(err) {
                }

                if(srcElement != selectedInstance.element.key
                    || me._cloudElementsUtils.isEmpty(selectObjectName)) {
                    continue;
                }

                var obj = new Object();
                obj.vendorName = targetObjectName;
                obj.name = selectObjectName;
                obj.transformed = true;
                objectsAndTransformation.push(obj);

                tempObjectNames[selectObjectName] = true;
            }
        }

        //Now navigate through all the objects from source and push the pending objects to
        var objs = me.all[selectedInstance.element.key].objects;
        for(var i = 0; i < objs.length; i++) {
            var objName = objs[i];
            if(me._cloudElementsUtils.isEmpty(tempObjectNames[objName])) {
                var obj = {
                    name: objName,
                    transformed: false
                };
                objectsAndTransformation.push(obj);
            }
        }

        me.all[selectedInstance.element.key].objectsAndTransformation = objectsAndTransformation;
    },

    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    // Load selected Object metadata
    //----------------------------------------------------------------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------------
    loadObjectMetaData: function(selectedInstance, selectedObject, targetInstance) {

        return this._elementsService.loadObjectMetaData(selectedInstance, selectedObject)
            .then(
            this._handleLoadObjectMetadata.bind(this, selectedInstance, selectedObject, targetInstance),
            this._handleLoadErrorObjectMetadata.bind(this));
    },

    //This method is used for reloading the source object metadata on changing the target object
    loadObjectMetaDataFromCache: function(selectedInstance, selectedObject, targetInstance) {
        var me = this;

        var objectMetadata = new Object;
        angular.copy(me.all[selectedInstance.element.key].metadataflat[selectedObject], objectMetadata);
        return me._stripSelectedInstanceMetadata(selectedInstance, targetInstance, selectedObject, objectMetadata);
    },

    _handleLoadErrorObjectMetadata: function(result) {
        var me = this;
        me._notifications.notify(bulkloader.events.ERROR, "Error getting the object fields");
        //return "Error getting the discovery object";
    },

    _handleLoadObjectMetadata: function(selectedInstance, selectedObject, targetInstance, result) {
        var me = this;

        if(me._cloudElementsUtils.isEmpty(me.all[selectedInstance.element.key].metadata)) {
            me.all[selectedInstance.element.key].metadata = new Object;
            me.all[selectedInstance.element.key].metadataflat = new Object;
        }

        var objectMetadata = result.data;
        var objectMetadataFlat = new Object;

        angular.copy(objectMetadata, objectMetadataFlat);
        me.all[selectedInstance.element.key].metadataflat[selectedObject] = objectMetadataFlat;

        return me._stripSelectedInstanceMetadata(selectedInstance, targetInstance, selectedObject, objectMetadata);
    },

    _stripSelectedInstanceMetadata: function(selectedInstance, targetInstance, selectedObject, objectMetadata){
        var me = this;

        //Check if there is a Transformation already applied for the Object, if so strip the rows which are already mapped
        var trans = me.all[targetInstance.element.key].transformations;
        if(!me._cloudElementsUtils.isEmpty(trans)) {
            var transformationKeys = Object.keys(trans);
            var transformation = null;
            var targetObject = null;

            for(var i = 0; i < transformationKeys.length; i++) {
                targetObject = transformationKeys[i];
                transformation = trans[targetObject];

                var selectObjectName = null;
                try {
                    var spl = targetObject.split('_');
                    selectObjectName = spl[1];
                }
                    //Ignore the error
                catch(err) {
                }

                if(selectObjectName == selectedObject) {
                    break;
                }
                else {
                    transformation = null;
                }
            }

            if(!me._cloudElementsUtils.isEmpty(transformation)
                && !me._cloudElementsUtils.isEmpty(transformation.fields)) {

                //Before restructuring, using trasformation find the fields that are transformed and remove from metadata
                for(var i = 0; i < transformation.fields.length; i++) {
                    var t = transformation.fields[i];
                    me._findAndRemoveInSourceMetadata(objectMetadata, t.path);
                }
            }
        }

        me._restructureObjectMetadata(objectMetadata, 'path');
        me.all[selectedInstance.element.key].metadata[selectedObject] = objectMetadata;

        return objectMetadata;
    },

    _findAndRemoveInSourceMetadata: function(sourceMetadata, path) {
        for(var i = 0; i < sourceMetadata.fields.length; i++) {
            var field = sourceMetadata.fields[i];
            if(field.vendorPath === path) {
                sourceMetadata.fields.splice(i, 1);
                break;
            }
        }
    },

    loadObjectMapping: function(selectedInstance, selectedObject, targetInstance, objectMetadata) {
        var me = this;

        var trans = me.all[targetInstance.element.key].transformations;
        if(me._cloudElementsUtils.isEmpty(trans)) {
            return "";
        }

        var transformationKeys = Object.keys(trans);
        var transformedObject = null;
        var targetObject = null;

        for(var i = 0; i < transformationKeys.length; i++) {
            targetObject = transformationKeys[i];
            transformedObject = trans[targetObject];

            var selectObjectName = null;
            try {
                var spl = targetObject.split('_');
                selectObjectName = spl[1];
            }
                //Ignore the error
            catch(err) {
            }

            if(selectObjectName == selectedObject) {
                transformedObject.name = selectObjectName;
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

        return me.loadTargetObjectMetaMapping(selectedInstance, selectedObject, targetInstance, transformedObject);
    },

    _restructureObjectMetadata: function(objectMetadata, pathName) {
        var me = this;
        if(this._cloudElementsUtils.isEmpty(objectMetadata)
            || this._cloudElementsUtils.isEmpty(objectMetadata.fields)) {
            return;
        }

        if(this._cloudElementsUtils.isEmpty(pathName)) {
            pathName = 'vendorPath';
        }

        for(var i = 0; i < objectMetadata.fields.length; i++) {
            var field = objectMetadata.fields[i];

            if(!this._cloudElementsUtils.isEmpty(field.vendorReadOnly)
                && field.vendorReadOnly == true) {
                continue;
            }

            if(field.vendorPath.indexOf('.') !== -1) {

                var fieldParts = field.vendorPath.split('.').slice(1).join('.');
                var objField = field.vendorPath.split('.')[0];

                var newInnerMetaData = this._getObjectInMetaData(objectMetadata, objField);
                if(this._cloudElementsUtils.isEmpty(newInnerMetaData)) {
                    newInnerMetaData = new Object;
                    newInnerMetaData[pathName] = objField;
                    newInnerMetaData.vendorPath = objField;
                    if(!me._cloudElementsUtils.isEmpty(field.vendorDisplayName)) {
                        newInnerMetaData.vendorDisplayName = objField;
                    }
                    newInnerMetaData['fields'] = [];
                    var t = 'object';
                    if(objField.indexOf('[*]') !== -1) {
                        t = 'array';
                    }
                    newInnerMetaData['type'] = t;

                    objectMetadata.fields.push(newInnerMetaData);
                }

                if(fieldParts.indexOf('.') === -1) {
                    var newInnerField = angular.copy(field);
                    newInnerField.actualVendorPath = field.vendorPath;
                    newInnerField.vendorPath = null;
                    newInnerField[pathName] = fieldParts;

                    newInnerField.vendorDisplayName = field.vendorDisplayName;
                    newInnerField.vendorRequired = field.vendorRequired;
                    newInnerField.vendorReadOnly = field.vendorReadOnly;

                    if(pathName != 'path' && this._cloudElementsUtils.isEmpty(field.path)) {
                        newInnerField.path = field.path;
                    }

                    if(this._cloudElementsUtils.isEmpty(newInnerField.fields)) {
                        newInnerField.fields = [];
                    }
                    newInnerMetaData.fields.push(newInnerField);
                }
                else {
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
            .filter(function(field) {
                if(field[pathName] != null) {
                    return field[pathName].indexOf('.') === -1;
                } else {
                    return field.vendorPath.indexOf('.') === -1;
                }

            });
    },

    _getObjectInMetaData: function(metadata, objectname) {
        for(var i = 0; i < metadata.fields.length; i++) {
            var field = metadata.fields[i];

            if(field.vendorPath === objectname) {
                return field;
            }
        }
    },

    _structureInnerObjectMetadata: function(metadata, fieldParts, field, pathName) {
        var me = this;
        var innerfieldParts = fieldParts.split('.').slice(1).join('.');
        var objField = fieldParts.split('.')[0];

        var newInnerMetaData = this._getObjectInMetaData(metadata, objField);
        if(this._cloudElementsUtils.isEmpty(newInnerMetaData)) {
            newInnerMetaData = new Object;
            newInnerMetaData.vendorPath = objField;
            newInnerMetaData[pathName] = objField;
            if(!me._cloudElementsUtils.isEmpty(field.vendorDisplayName)) {
                newInnerMetaData.vendorDisplayName = objField;
            }
            newInnerMetaData[pathName] = objField;
            newInnerMetaData['fields'] = [];
            var t = 'object';
            if(objField.indexOf('[*]') !== -1) {
                t = 'array';
            }
            newInnerMetaData['type'] = t;
            metadata.fields.push(newInnerMetaData);
        }

        if(innerfieldParts.indexOf('.') === -1) {
            var newInnerField = angular.copy(field);
            newInnerField.actualVendorPath = field.vendorPath;
            newInnerField.vendorPath = null;

            newInnerField.vendorDisplayName = field.vendorDisplayName;
            newInnerField.vendorRequired = field.vendorRequired;
            newInnerField.vendorReadOnly = field.vendorReadOnly;

            newInnerField[pathName] = innerfieldParts;
            if(pathName != 'path' && this._cloudElementsUtils.isEmpty(field.path)) {
                newInnerField.path = field.path;
            }

            if(this._cloudElementsUtils.isEmpty(field.fields)) {
                newInnerField.fields = [];
            }
            newInnerMetaData.fields.push(newInnerField);
        }
        else {
            this._structureInnerObjectMetadata(newInnerMetaData, innerfieldParts, field, pathName);
        }
    },

    loadTargetObjectMetaMapping: function(selectedInstance, selectedInstanceObject, targetInstance, transformation) {
        var me = this;

        return me._elementsService.loadObjectMetaData(targetInstance, transformation.vendorName)
            .then(
            me._handleTargetLoadObjectMetadata.bind(me, selectedInstance, selectedInstanceObject, targetInstance, transformation),
            me._handleTargetLoadErrorObjectMetadata.bind(me));
    },

    _handleTargetLoadErrorObjectMetadata: function(result) {
        var me = this;
        me._notifications.notify(bulkloader.events.ERROR, "Error getting the target object metadata");
        //return "Error getting the discovery object";
    },

    _handleTargetLoadObjectMetadata: function(selectedInstance, selectedInstanceObject, targetInstance, transformation, result) {
        var me = this;

        var targetObjectName = transformation.vendorName;

        if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key].metadata)) {
            me.all[targetInstance.element.key].metadata = new Object;
            me.all[targetInstance.element.key].metadataflat = new Object;
        }

        if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key].metamapping)) {
            me.all[targetInstance.element.key].metamapping = new Object;
        }

        var objectMetadata = result.data;
        var objectMetadataFlat = new Object;

        angular.copy(objectMetadata, objectMetadataFlat);
        me.all[targetInstance.element.key].metadataflat[targetObjectName] = objectMetadataFlat;

        if(!me._cloudElementsUtils.isEmpty(transformation)
            && !me._cloudElementsUtils.isEmpty(transformation.fields)) {
            //Before restructuring, set the Path values from trasformation so that its easy in mapping
            for(var i = 0; i < transformation.fields.length; i++) {
                var t = transformation.fields[i];
                me._setPathInMetaData(objectMetadata, t.path, t.vendorPath);
            }
        }

        me._restructureObjectMetadata(objectMetadata);

        me.all[targetInstance.element.key].metadata[targetObjectName] = objectMetadata;

        //Create an empty mapping, basically the definition from metadata and return it
        return me._createEmptyMapping(selectedInstance, selectedInstanceObject, targetInstance, targetObjectName, objectMetadata)
    },

    hasDisplayName: function(instance, objectname) {
        var me = this;

        var metadataflat = me.all[instance.element.key].metadataflat[objectname];

        var displayName = false;
        var count = 0;
        for(var i = 0; i < metadataflat.fields.length; i++) {
            var field = metadataflat.fields[i];

            if(!this._cloudElementsUtils.isEmpty(field.vendorDisplayName)) {
                displayName = true;
                break;
            }
            //Just dont want to loop all the field to find out
            //Should be a good number to decide what to sort on
            if(count == 10) {
                break;
            }
            count++;
        }

        return displayName;
    },

    _createEmptyMapping: function(selectedInstance, selectedInstanceObject, targetInstance, targetObjectName, objectMetadata) {
        var me = this;

        if(me._cloudElementsUtils.isEmpty(me.all[targetInstance.element.key].metamapping)) {
            me.all[targetInstance.element.key].metamapping = new Object;
        }

        var newMapping = new Object;
        var name = selectedInstance.element.key + '_' + selectedInstanceObject + '_' + targetObjectName;
        newMapping['name'] = name;
        newMapping['vendorName'] = targetObjectName;
        newMapping['fields'] = objectMetadata.fields;
        me.all[targetInstance.element.key].metamapping[name] = newMapping;
        return newMapping;
    },

    _setPathInMetaData: function(objectMetadata, path, vendorPath) {
        for(var i = 0; i < objectMetadata.fields.length; i++) {
            var field = objectMetadata.fields[i];
            if(field.vendorPath === vendorPath) {
                field.path = path;
                break;
            }
        }
    },

    getTargetMetaMapping: function(targetInstance, sourceObject, targetObject) {
        var me = this;

        var targetMetaMapping = me.all[targetInstance.element.key].metamapping;
        if(me._cloudElementsUtils.isEmpty(targetMetaMapping)) {
            return null;
        }

        var mKeys = Object.keys(targetMetaMapping);

        for(var i = 0; i < mKeys.length; i++) {
            var mappingName = mKeys[i];
            var spl = mappingName.split('_');
            selectObjectName = spl[1];
            targetObjectName = spl[2];

            if(selectObjectName == sourceObject &&
                targetObjectName == targetObject) {
                return targetMetaMapping[mKeys[i]];
            }
        }
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
        var objectsAndTrans = objects.reduce(function(total, objects) {
            total[ objects.name ] = objects.transformed;
            return total;
        }, {});

        me.all[targetInstance.element.key].objectsAndTrans = objectsAndTrans;

        //Construct the Object Definition and inner Object definitions
        //Save all the definitions at instance level
        me._constructAndSaveObjectDefinition(targetInstance, sourceInstance);
    },

    _findDefinition: function(definitionArray, objectName, p, currentDefinition) {
        var me = this;

        var pArray = p.split('.');

        var name = objectName;
        var objectDefinition = null;
        for(var i = 0; i < pArray.length - 1; i++) {
            var pathStep = pArray[i];
            name = name + '_' + pathStep;

            if(me._cloudElementsUtils.isEmpty(definitionArray[name])) {
                var objDef = {
                    fields: []
                };
                definitionArray[name] = objDef;
                objectDefinition = objDef;

                currentDefinition.fields.push({
                    'path': pathStep,
                    'type': name
                });

                currentDefinition = objectDefinition;

            } else {
                objectDefinition = definitionArray[name];
                currentDefinition = objectDefinition;
            }
        }

        return objectDefinition;
    },

    _addToDefinition: function(definitionArray, objectName, mData, objDefinition) {
        var me = this;

        if(objDefinition == null) {
            objDefinition = {
                fields: []
            };

            if(me._cloudElementsUtils.isEmpty(definitionArray[objectName])) {
                definitionArray[objectName] = objDefinition;
            } else {
                objDefinition = definitionArray[objectName];
            }

        }

        for(var i = 0; i < mData.fields.length; i++) {
            var mapperData = mData.fields[i];

            if(me._cloudElementsUtils.isEmpty(mapperData.type)) {
                mapperData.type = 'string'; //this is dirty fix for setting a type value by default
            }

            if(this._isLiteral(mapperData.type.toLowerCase())
                || this._isDateFormat(mapperData.type)) {
                var t = mapperData.type;
                var p = mapperData.path;

                if(this._isDateFormat(t)) {
                    t = 'date';
                }

                if(!this._cloudElementsUtils.isEmpty(p) && p.indexOf('.') > 0) {
                    var objDef = me._findDefinition(definitionArray, objectName, p, objDefinition);
                    var pArray = p.split('.');
                    objDef.fields.push({
                        'path': pArray[pArray.length - 1],
                        'type': t
                    });
                }
                else if(!this._cloudElementsUtils.isEmpty(p)) {
                    objDefinition.fields.push({
                        'path': p,
                        'type': t
                    });
                }
            }
            else {
                me._addToDefinition(definitionArray, objectName, mapperData);
            }
        }
    },

    //Definition that will be created is always in flat structure
    _constructDefinition: function(definitionArray, objectName, mData, objDefinition) {
        var me = this;

        if(objDefinition == null) {
            objDefinition = {
                fields: []
            };

            definitionArray[objectName] = objDefinition;
        }

        for(var i = 0; i < mData.fields.length; i++) {
            var mapperData = mData.fields[i];

            if(me._cloudElementsUtils.isEmpty(mapperData.type)) {
                mapperData.type = 'string'; //this is dirty fix for setting a type value by default
            }

            if(this._isLiteral(mapperData.type.toLowerCase())
                || this._isDateFormat(mapperData.type)) {
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
            else {
                //This is where its of type Object so create a definition out of it
                // and also add it to the base definition
                var name = mapperData.path;
                if(me._cloudElementsUtils.isEmpty(name) || name.length == 0) {
                    name = mapperData.vendorPath
                }

                if(mapperData.type == 'array') {
                    name = name.replace('[*]', '');
                }

                name = objectName + '_' + name;
                me._constructDefinition(definitionArray, name, mapperData);

                var t = mapperData.vendorPath;
                var p = mapperData.path;
                if(this._cloudElementsUtils.isEmpty(p) || p.length == 0) {
                    p = mapperData.vendorPath
                }
                if(mapperData.type == 'array') {
                    t = 'array[' + mapperData.vendorPath.replace('[*]', '') + ']';
                    p = p + '[*]';
                }

                if(this._cloudElementsUtils.isEmpty(t)) {
                    t = mapperData.actualVendorPath;
                }

                objDefinition.fields.push({
                    'path': p,
                    'type': t
                });
            }
        }
    },

    _constructAndSaveObjectDefinition: function(selectedInstance, sourceInstance) {
        var me = this;

        var mData = me.all[selectedInstance.element.key].metamapping;
        var objectsAndTrans = me.all[selectedInstance.element.key].objectsAndTrans;

        var mKeys = Object.keys(mData);

        var definitionArray = new Object;
        for(var i = 0; i < mKeys.length; i++) {
            me._addToDefinition(definitionArray, mKeys[i], mData[mKeys[i]]);
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

        if(!me._cloudElementsUtils.isEmpty(defs)
            && !me._cloudElementsUtils.isEmpty(defs[key])
            && defs[key].level == 'instance') {
            methodType = 'PUT';
        }

        if(!me._cloudElementsUtils.isEmpty(useMethodType)) {
            methodType = useMethodType;
        }

        definitionSaveCounter++;

        return me._elementsService.saveObjectDefinition(selectedInstance, key, definitionArray[key], 'instance', methodType)
            .then(
            me._handleOnSaveObjectDefinition.bind(this, selectedInstance, sourceInstance, definitionArray, definitionSaveCounter),
            me._handleOnSaveObjectDefinitionError.bind(this, selectedInstance, sourceInstance, definitionArray, definitionSaveCounter));
    },

    _handleOnSaveObjectDefinitionError: function(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter, error) {
        var me = this;

        definitionSaveCounter--;

        if(error.status == 404) {
            return me._saveDefinitionFromArray(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter, 'POST');
        }
        else if(error.status == 409) {
            return me._saveDefinitionFromArray(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter, 'PUT');
        }
        else {
            this._notifications.notify(bulkloader.events.ERROR, error.data.message);
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
        var savedkey = keys[definitionSaveCounter - 1];
        me.all[selectedInstance.element.key].definitions[savedkey] = definitionArray[savedkey];

        //Save transformations once all the definitions are stored
        if(definitionSaveCounter == keys.length) {
            return me._constructAndSaveObjectTransformation(selectedInstance, sourceInstance);
        }
        else {
            return me._saveDefinitionFromArray(selectedInstance, sourceInstance, definitionArray, definitionSaveCounter);
        }
    },

    _constructDeeperTransformation: function(objectTransformation, objectMapperData, objectName) {

        var me = this;

        if(objectMapperData.type == 'array') {
            objectName = objectName + '[*]';
        }

        for(var i = 0; i < objectMapperData.fields.length; i++) {
            var mapperData = objectMapperData.fields[i];
            var mapperType = mapperData.type.toLowerCase();

            if(this._isLiteral(mapperType)
                || this._isDateFormat(mapperData.type)) {
                var p = mapperData.vendorPath;
                if(this._isLiteralArray(mapperData.type)) {
                    p = p + '[*]';
                }

                if(!me._cloudElementsUtils.isEmpty(mapperData.path)) {
                    var vp = mapperData.vendorPath;
                    if(!me._cloudElementsUtils.isEmpty(objectName)) {
                        vp = objectName + '.' + vp;
                    }

                    objectTransformation.fields.push({
                        'path': mapperData.path,
                        'vendorPath': vp
                    });
                }
            }
            else {
                var newObjectName = mapperData.vendorPath;
                if(!me._cloudElementsUtils.isEmpty(objectName)) {
                    newObjectName = objectName + '.' + mapperData.vendorPath;
                }
                this._constructDeeperTransformation(objectTransformation, mapperData, newObjectName);
            }
        }
    },

    _constructTransformation: function(selectedInstance, transformationArray, name, vendorName, metaData) {
        var me = this;

        var objectTransformation = {
            'vendorName': vendorName,
            //For setting ignore unmapped, only the ones which are mapped will be returned
            'configuration': [
                {
                    "type": "passThrough",
                    "properties": {
                        "fromVendor": false,
                        "toVendor": false
                    }
                }
            ],
            fields: []
        };
        me._constructDeeperTransformation(objectTransformation, metaData);
        transformationArray[name] = objectTransformation;
    },

    _constructAndSaveObjectTransformation: function(selectedInstance, sourceInstance) {
        var me = this;

        var mData = me.all[selectedInstance.element.key].metamapping;
        var objectsAndTrans = me.all[selectedInstance.element.key].objectsAndTrans;
        var mKeys = Object.keys(mData);

        var transformationArray = new Object;

        for(var i = 0; i < mKeys.length; i++) {
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

        if(!me._cloudElementsUtils.isEmpty(trans)
            && !me._cloudElementsUtils.isEmpty(trans[key])) {
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
            this._handleOnSaveTransformationError.bind(this, selectedInstance, transformationArray, transformationSaveCounter));
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
            this._notifications.notify(bulkloader.events.ERROR, error.data.message);
            return false;
        }
    },

    _handleOnSaveTransformation: function(selectedInstance, transformationArray, transformationSaveCounter, result) {
        var me = this;

        var keys = Object.keys(transformationArray);

        //Setting the saved transformation
        if(me._cloudElementsUtils.isEmpty(me.all[selectedInstance.element.key].transformations)) {
            me.all[selectedInstance.element.key].transformations = new Object();
        }
        var savedkey = keys[transformationSaveCounter - 1];
        me.all[selectedInstance.element.key].transformations[savedkey] = transformationArray[savedkey];

        //Save transformations once all the definitions are stored
        if(transformationSaveCounter == keys.length) {
            this._notifications.notify(bulkloader.events.TRANSFORMATION_SAVED);
            //return true;
        }
        else {
            return me._saveTransformationFromArray(selectedInstance, transformationArray, transformationSaveCounter);
        }
    }


});

/**
 * Picker Factory object creation
 *
 */
(function() {

    var MapperObject = Class.extend({

        instance: new Mapper(),

        /**
         * Initialize and configure
         */
        $get: ['CloudElementsUtils', 'ElementsService', 'Notifications', 'Picker', function(CloudElementsUtils, ElementsService, Notifications, Picker) {
            this.instance._cloudElementsUtils = CloudElementsUtils;
            this.instance._elementsService = ElementsService;
            this.instance._notifications = Notifications;
            this.instance._picker = Picker;
            return this.instance;
        }]
    });

    angular.module('bulkloaderApp')
        .provider('Mapper', MapperObject);
}());