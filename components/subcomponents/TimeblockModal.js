import React, {useState, useEffect, useRef} from 'react'
import {Modal, View, StyleSheet, TextInput, Text, Button, TouchableOpacity} from 'react-native'
import {Picker} from '@react-native-picker/picker'
import Icon from 'react-native-vector-icons/FontAwesome'
import {getTimeblockModalData, storeNewCategory, storeNewTaskName} from '../../utilities/DatabaseUtils'
import DateTimePickerModal from "react-native-modal-datetime-picker";
import {dateObjToTimeString, onSubmitTimeblockModal, timeStringToDateObj} from '../../utilities/TimeblockUtils'
import CreateCategoryModal from './CreateCategoryModal'

/**
 * These are the elements of the modalProps object
 * 
 * @param {boolean} visible
 * @param {number} timeblockID
 * @param {string} taskName // existing taskName if this component was rendered for editing a timeblock
 * @param {string} startTime
 * @param {string} endTime
 * @param {string} category
 * @param {Function} sendData // function for sending data to TimeblockScreen
 */
const TimeblockModal = ({ modalProps }) => {

    useEffect(() => {
        setVisibility(modalProps.visible)
        setCurrentTaskName(modalProps.taskName)
        setCurrentCategory(modalProps.category)
        setCurrentStartTime(modalProps.startTime)
        setCurrentEndTime(modalProps.endTime)
    }, [modalProps]) // runs onMount and when modalProps changes

    // holding field data for when the user submits and for showing selected/existing values
    const [currentTaskName, setCurrentTaskName] = useState();
    const [currentCategory, setCurrentCategory] = useState();

    // startTime/endTime text and modal state variables
    const [isStartTimePickerVisible, setStartTimePickerVisible] = useState(false)
    const [currentStartTime, setCurrentStartTime] = useState()
    const [isEndTimePickerVisible, setEndTimePickerVisible] = useState(false)
    const [currentEndTime, setCurrentEndTime] = useState()

    // initialize visibility to modalProps.visible onMount and watch it for changes (when the user closes this modal)
    const [isVisible, setVisibility] = useState(() => false)

    // getting existing data; will get it on mount and when the newDataFlag is set to true (when the user types in a new task name or category)
    const [existingData, setExistingData] = useState({categories: [], taskNames: [], categoryNames: []})
    const [newDataFlag, setNewDataFlag] = useState(() => false)
    useEffect(async () => {
        // const d = await getTimeblockModalData()
        // console.log(d)
        setExistingData(await getTimeblockModalData())
        if (newDataFlag){
            setNewDataFlag(false)
        }
    }, [newDataFlag, isVisible]);

    // similar to modalProps in TimeblockScreen, hold and manipulate the props for ColorPickerModal
    const [createCategoryModalProps, setCreateCategoryModalProps] = useState(() => {
        return {
            visible: false,
            sendData: handleCreateCategoryData, 
            sendVisibility: setCreateCategoryModalVisibility
        }
    });
    
    // hold the current color for the colorDisplay View (box that shows the user the current color)
    const [currentColor, setCurrentColor] = useState(() => "#FFFFFF");

    // receive color selection from ColorPickerModal and set state
    // have an id param so this method is compatible with ColorPickerModal; need this param for CategoriesScreen
    const handleColorSelection = (id, color) => {
        setCurrentColor(color);
    }

    // have to send this to ColorPickerModal so we can change its props when it closes
    const setColorModalVisibility = (boolean) => {
        setColorModalProps(colorModalProps => {
            return {...colorModalProps, visible: boolean}
        })
    }

    // return Picker Items for each existing taskName
    const getTaskNamePickerItems = () => {
        // dont add the existing taskName to the list; it's already in the Picker as the first Item
        return (
            existingData.taskNames.map(taskObj => {
                if (taskObj.name && taskObj.id){
                    return <Picker.Item label={taskObj.name} value={taskObj.name} key={taskObj.id} />
                }
            })
        )
    }

    // return Picker Items for each existing taskName
    const getCategoryPickerItems = () => {
        // dont add the existing category to the list; it's already in the Picker as the first Item
        return (
            existingData.categories.map(categoryObj => {
                if (categoryObj.name && categoryObj.id){
                    return <Picker.Item label={categoryObj.name} value={categoryObj.name} key={categoryObj.id} />
                }
            })
        )
    }

    const taskNameTextInput = useRef()

    // return components for getting the timeblock's taskName
    const getTaskNameComponents = () => {

        // if we just want to allow the user to type in a task name
        if (existingData.taskNames.length == 0){
            return (
                <View style={styles.noExistingTasksView}>
                    <Text style={{marginLeft: "5%", marginTop: -15, fontSize: 18, fontWeight: "bold"}}>{"Task name"}</Text>
                    <TextInput 
                        spellCheck={false} 
                        style={styles.taskText} 
                        placeholder={"Type here..."} 
                        placeholderTextColor={"grey"}
                        onChangeText={setCurrentTaskName}
                        style={styles.taskNameTextInput}
                    >
                    </TextInput>
                </View>
            )
        }
        else{ // display dropdown menu of previosly used taskNames in alphabetical order
            return (
                <View style={styles.taskNameView}>
                    <Text 
                        style={{marginLeft: "5%", marginTop: 0, width: "40%", fontSize: 18, fontWeight: "bold"}}
                    >
                        {"Task name"}
                    </Text>
                    <Picker 
                        onValueChange={(itemValue, itemIndex) => setCurrentTaskName(itemValue)}
                        selectedValue={currentTaskName}
                        style={styles.taskNamePicker}
                        prompt="Select a task name"
                    >
                        <Picker.Item label={"N/A"} value={"N/A"} />
                        {getTaskNamePickerItems()}
                    </Picker>
                    <Text style={styles.taskNameORText}>
                        {"OR"}
                    </Text>
                    <TextInput 
                        ref={taskNameTextInput}
                        spellCheck={false} 
                        style={styles.taskText} 
                        placeholder={"Type here..."} 
                        placeholderTextColor={"grey"}
                        onSubmitEditing={e => {
                            handleNewTaskName(e.nativeEvent.text)
                            taskNameTextInput.current.clear()
                        }}
                        style={styles.taskNameTextInput}
                    >
                    </TextInput>
                </View>
            )
        }
    }

    // return components for getting the timeblock's category
    const getCategoryComponents = () => {
        if (existingData.categories.length == 0){
            // this is a separate branch since the created category will go straight to being adopted 
            // as opposed to being added to the Picker and selected
            return (
                <View style={styles.noExistingCatsView}>
                    <Button 
                        title={"Create category"}
                        onPress={() => setCreateCategoryModalProps({
                            sendData: handleCreateCategoryData,
                            sendVisibility: setCreateCategoryModalVisibility,
                            visible: true,
                            noExistingCats: true
                        })}
                    />
                    <CreateCategoryModal
                        props={createCategoryModalProps}
                    />
                </View>
            )
        }
        else{
            return (
                <View style={styles.categoryView}>
                    <Text style={{marginLeft: "5%", fontSize: 18, fontWeight: "bold"}}>{"Category"}</Text>
                    <Picker 
                        onValueChange={(itemValue, itemIndex) => setCurrentCategory(itemValue)}
                        selectedValue={currentCategory}
                        style={styles.categoryPicker}
                        prompt={"Select a category"}
                    >
                        <Picker.Item label={"N/A"} value={"N/A"} />
                        {getCategoryPickerItems()}
                    </Picker>
                    <Text style={styles.categoryORText}>
                        {"OR"}
                    </Text>
                    <Button 
                        title={"Create category"}
                        onPress={() => setCreateCategoryModalProps({
                            sendData: handleCreateCategoryData,
                            sendVisibility: setCreateCategoryModalVisibility,
                            visible: true,
                            noExistingCats: false
                        })}
                    />
                    <CreateCategoryModal
                        props={createCategoryModalProps}
                    />
                </View>
            )
        }
    }

    // have to send this to CreateCategoryModal so we can change its props when it closes
    const setCreateCategoryModalVisibility = (boolean) => {

        setCreateCategoryModalProps(props => {
            return {...props, visible: boolean}
        })
    }

    // save the new category which will get added to and selected by the picker
    const handleCreateCategoryData = async (categoryName, color) => {

        if (categoryName.trim() == "" || categoryName == "N/A"){
            return
        }

        for (catObj of existingData.categories){
            if (catObj.name.trim() == categoryName.trim()){
                alert("This category already exists")
                return
            }
        }

        setCurrentCategory(categoryName)

        setExistingData(existingData => {
            existingData.categories.push({
                name: categoryName,
                color: color,
                id: "TBD"
            })
            existingData.categoryNames.push(categoryName)
            return existingData
        })

        // save the new category
        const newCat = await storeNewCategory(categoryName, color, existingData.categories.filter(cat => cat.id != "TBD"), null)
        

        // only update and render the picker if there were already categories
        setExistingData(existingData => {
            existingData.categories[existingData.categories.findIndex(cat => cat.id == "TBD")] = newCat
            return existingData
        })
    }

    // set state (which will add the task to the Picker and select it) then hit DB
    // this function is only used when there are preexisting taskNames
    const handleNewTaskName = async (newTaskName) => {

        setCurrentTaskName(newTaskName.trim())

        if (newTaskName.trim() == "" || newTaskName == "N/A"){
            return   
        }

        for (taskObj of existingData.taskNames){
            if (taskObj.name.trim() == newTaskName.trim()){
                alert("This task name already exists")
                return
            }
        }

        setExistingData(existingData => {
            existingData.taskNames.push({
                id: "TBD",
                name: newTaskName
            })
            return existingData
        })

        // save the new taskName and update existingData so the new taskName has an id
        const newTaskNameObj = await storeNewTaskName(newTaskName, existingData.taskNames.filter(TN => TN.id != "TBD"), null)

        setExistingData(existingData => {
            existingData.taskNames[existingData.taskNames.findIndex(TN => TN.id == "TBD")] = newTaskNameObj
            return existingData
        })
    }

    // on duplicate btn pressed
    const onDuplicate = () => {
        // trigger duplication and hide modal

        console.log("Duplicated")
    }

    // on repeat btn pressed
    const onRepeat = () => {
        // trigger another modal

        console.log("Repeated")
    }

    return (
        <Modal visible={isVisible} transparent={true} animationType={'slide'} style={styles.modal}>
            <View style={styles.backgroundView}>
                <View style={styles.outerContentContainer}>
                    <View style={styles.innerContentContainer}>
                        <TouchableOpacity 
                            onPress={() => {
                                setVisibility(false)
                                setCurrentColor(undefined)
                            }} 
                            style={{width: 40, height: 40, paddingLeft: 10, paddingTop: 5, marginBottom: 20}}
                        >
                            <Icon 
                            name="times" 
                            size={40} 
                            style={styles.XBtn} 
                            />
                        </TouchableOpacity>
                        {getTaskNameComponents()}
                        <View style={styles.outerTimeView}>
                            <Text style={{marginLeft: "5%", marginBottom: "5%", fontSize: 18, fontWeight: "bold"}}>{"Times"}</Text>
                            <DateTimePickerModal
                                date={timeStringToDateObj(modalProps.startTime)}
                                isVisible={isStartTimePickerVisible}
                                mode="time"
                                onConfirm={date => {
                                    setStartTimePickerVisible(false); 
                                    setCurrentStartTime(dateObjToTimeString(date))
                                }}
                                onCancel={() => {
                                    setStartTimePickerVisible(false);
                                }}
                            />
                            <DateTimePickerModal
                                date={timeStringToDateObj(modalProps.endTime)}
                                isVisible={isEndTimePickerVisible}
                                mode="time"
                                onConfirm={date => {
                                    setEndTimePickerVisible(false); 
                                    setCurrentEndTime(dateObjToTimeString(date))
                                }}
                                onCancel={() => {
                                    setEndTimePickerVisible(false); 
                                }}
                            />
                            <View style={styles.startTimeView}>
                                <Text>{currentStartTime}</Text>
                                <Button title="Set start time" onPress={() => setStartTimePickerVisible(true)} />
                            </View>
                            <View style={styles.endTimeView}>
                                <Text>{currentEndTime}</Text>
                                <Button title="Set end time" onPress={() => setEndTimePickerVisible(true)} />
                            </View>
                        </View>
                        {getCategoryComponents()}
                        <View style={styles.allButtonsView}>
                            <Button title="Duplicate" style={styles.duplicateBtn} onPress={onDuplicate} />
                            <Button title="Repeat" style={styles.repeatBtn} onPress={onRepeat} />
                            <Button title="Submit" style={styles.submitBtn} onPress={() => {
                                // copy all data into the controller where it will validate modal data -> ship to TimeblockScreen and
                                // update existingData in the DB as necessary
                                onSubmitTimeblockModal(
                                    modalProps,
                                    {
                                        currentTaskName: currentTaskName != "N/A" ? currentTaskName.trim() : "",
                                        currentCategory: currentCategory != "N/A" ? currentCategory.trim() : "",
                                        currentColor: currentCategory != "N/A"  && currentCategory.trim() != "" ? currentColor : "",
                                        currentStartTime: currentStartTime,
                                        currentEndTime: currentEndTime
                                    },
                                    existingData,
                                    setVisibility,
                                    setCurrentColor,
                                    setNewDataFlag
                                )
                            }} />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    modal: {
        
    },
    backgroundView: {
        backgroundColor: "#000000aa",
        flex: 1
    },
    outerContentContainer: {
        backgroundColor: "white",
        marginHorizontal: "4%",
        marginTop: "12%",
        borderWidth: .5,
        borderRadius: 15
    },
    innerContentContainer: {
        width: "100%"
    },
    taskNameView: {
        paddingBottom: 15
    },
    taskNamePicker: {
        width: "85%",
        alignSelf: "center",
        marginTop: -40,
        marginBottom: -20
    },
    taskNameTextInput: {
        width: "85%",
        alignSelf: 'center',
        marginTop: "6%",
        marginBottom: "5%",
        fontSize: 17
    },
    categoryView: {

    },
    noExistingCatsView: {

    },
    categoryPicker: {
        marginTop: -40,
        width: "85%",
        alignSelf: "center",
        marginBottom: 0
    },
    categoryTextInput: {
        width: "85%",
        alignSelf: 'center',
        fontSize: 17,
        marginTop: "6%",
        marginBottom: "10%"
    },
    colorDisplay: {
        
    },
    XBtn: {
        paddingRight: "6%",
        paddingTop: "4%",
        color: "#e50211"
    },
    allButtonsView: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
        paddingBottom: 20
    },
    onlyCreateButtonView: {
        marginHorizontal: "16%",
        marginBottom: 10
    },
    submitBtn: {
        
    },
    repeatBtn: {

    },
    duplicateBtn: {

    },
    createBtn: {
         
    },
    categoryORText: {
        textAlign: 'center',
        marginTop: -8
    },
    taskNameORText: {
        textAlign: 'center' ,
        marginTop: -8
    },
    colorPickerView: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: "4%"
    },
    outerTimeView: {

    },
    startTimeView: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    startTimeText: {

    },
    startTimeBtn: {
        
    },
    endTimeView: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    endTimeText: {
        
    },
    endTimeBtn: {

    }
})

export default TimeblockModal
