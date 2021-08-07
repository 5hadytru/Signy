import {Text, View, TouchableOpacity, TouchableWithoutFeedback,ScrollView, StyleSheet, TextInput, Animated} from 'react-native'
import React, {useState, useEffect} from 'react'

import Swipeable from 'react-native-gesture-handler/Swipeable'
import {RectButton} from 'react-native-gesture-handler'
import Icon from 'react-native-vector-icons/FontAwesome'

import UniversalNavbar from '../subcomponents/UniversalNavbar'
import { getExistingCategories, getLastCategoryID} from '../../utilities/DatabaseUtils'
import ColorPickerModal from '../subcomponents/ColorPickerModal'
import { updateCategoryName, 
         updateCategoryColor, 
         createNewCategory,
         deleteCategory } from '../../utilities/CategoriesUtils'
import SlideableTextInput from '../subcomponents/SlideableTextInput'


const CategoriesScreen = ({ navigation }) => {

    const [categories, setCategories] = useState(() => [])
    const [lastCategoryID, setLastCategoryID] = useState(() => -1)
    useEffect(async () => {
        const existingCategories = await getExistingCategories()
        setCategories(existingCategories);

        const lastID = await getLastCategoryID()
        setLastCategoryID(lastID)
    }, []) // runs onMount

    // flag for notifying the component to spawn an empty text input for a new category
    const [createCategoryFlag, setCreateCategoryFlag] = useState({event: null, boolean: false})

    const [colorModalProps, setColorModalProps] = useState({
        visible: false,
        sendColor: updateCategoryColor,
        categoryID: null,
        sendVisibility: setColorModalVisibility
    })
    // have to send this to ColorPickerModal so we can change its props when it closes; allows opening/closing for potential resuablility
    const setColorModalVisibility = (boolean) => {
        setColorModalProps(colorModalProps => {
            return {...colorModalProps, visible: boolean}
        })
    }

    // stores the timestamp of the last valid click so we can detect a double click; does not need to persist across renders
    const [lastClickTime, setLastClickTime] = useState(null);

    // when a double click occurs, trigger the creation of an empty category
    const detectDoubleClick = (event) => {

        setLastClickTime(event.nativeEvent.timestamp);

        // if the clicks were close enough to be a dbl click + they werent on the header, create an empty category
        if ((event.nativeEvent.timestamp - lastClickTime) < 400 && event.nativeEvent.pageY > 100){

            setLastClickTime(null);
            setCreateCategoryFlag(true)
        }
    }

    // function for rendering the delete buttons for when the user slides a text box to the right
    const renderLeftActions = (categoryID) => {
        return (
            <TouchableOpacity style={{ paddingRight: 15, alignSelf: 'center' }}>
                <Icon 
                    name={"trash"} 
                    size={28} 
                    onPress={() => deleteCategory(categoryID, categories, setCategories)}
                    style={{ color: "red" }}
                />
            </TouchableOpacity>
        )
    }

    // using the categories state variable (which is a list of tuples containing category data), return JSX representations of each category
    const getCategoryComponents = () => {

        return categories.map(category => {

            return (
                    <View 
                        style={{
                            flexDirection: "row", 
                            justifyContent: "flex-start", 
                            marginVertical: "5%"
                        }}
                        key={category.id}
                    >
                        <View style={{height: 35}}>
                            <Text style={{
                                backgroundColor: category.color ? category.color : "#ffffff", 
                                borderWidth: .5, 
                                borderColor: category.color && category.color.toLowerCase() == "#ffffff" ? "black" : "white",
                                marginLeft: "24%",
                                width: 35,
                                height: 35
                                }}
                                onPress={() => setColorModalProps({
                                    visible: true, 
                                    id: category.id, 
                                    sendColor: async (categoryID, newColor) => {
                                        // if the new value is diff than the old one
                                        if (newColor != category.color){
                                            updateCategoryColor(
                                                categories, 
                                                categoryID, 
                                                newColor, 
                                                setCategories
                                            )
                                        }
                                    },
                                    sendVisibility: setColorModalVisibility
                                })}
                            >
                                {"      "}
                            </Text>
                        </View>
                            <Swipeable
                                renderLeftActions={(progress, dragX) => renderLeftActions(category.id)}
                                overshootLeft={false}
                            >
                                <SlideableTextInput 
                                    categoryID={category.id}
                                    categoryName={category.name}
                                    sendNewCategoryName={(categoryID, newName) => {
                                        updateCategoryName(categories, categoryID, newName, setCategories)
                                    }}
                                />
                            </Swipeable>
                    </View>
            )
        })
    }

    return (
        <TouchableWithoutFeedback onPress={detectDoubleClick}>
            <View style={styles.container}>
                <UniversalNavbar navigation={navigation} />
                <Text style={styles.header}>
                    {"Categories"}
                </Text>
                <ScrollView>
                    {categories.length > 0 ? getCategoryComponents() : (<Text style={styles.noCatsText}>{"No categories"}</Text>)}
                    {createNewCategory(
                        createCategoryFlag,
                        setCreateCategoryFlag,
                        lastCategoryID,
                        setLastCategoryID,
                        setCategories
                    )}
                </ScrollView>
                <ColorPickerModal 
                    props={colorModalProps}
                />
            </View>
        </TouchableWithoutFeedback>
    )
}

const styles = StyleSheet.create({
    header: {
        fontSize: 30,
        fontWeight: "bold",
        marginLeft: "2%",
        marginVertical: "5%"
    },
    container: {
        flex: 1,
        width: "100%",
        backgroundColor: "white"
    },
    noCatsText: {
        fontSize: 20,
        textAlign: "center",
        marginTop: "30%",
        fontWeight: 'bold',
        fontStyle: 'italic'
    }
})

export default CategoriesScreen
