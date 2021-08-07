import React, {useState, useEffect, useRef} from 'react'
import {Modal, View, Button, StyleSheet, TextInput, Text} from 'react-native'
import ColorPickerModal from './ColorPickerModal'

const CreateCategoryModal = ({ props }) => {

    // initialize visibility to modalProps.visible onMount and watch it for changes (when the user closes this modal)
    const [isVisible, setVisibility] = useState(() => false)
    useEffect(() => {
        setVisibility(props.visible)
    }, [props])

    const [currentCategoryName, setCurrentCategoryName] = useState("")
    const [currentColor, setCurrentColor] = useState("#ffffff")

    // similar to modalProps in TimeblockScreen, hold and manipulate the props for ColorPickerModal
    const [colorModalProps, setColorModalProps] = useState(() => {
        return {
            visible: false,
            id: null,
            sendColor: setCurrentColor, 
            sendVisibility: setColorModalVisibility,
            initialColor: "#efe4ee"
        }
    });

    // have to send this to ColorPickerModal so we can change its props when it closes
    const setColorModalVisibility = (boolean) => {
        setColorModalProps(colorModalProps => {
            return {...colorModalProps, visible: boolean}
        })
    }

    const textInputRef = useRef() // for clearing

    return (
        <Modal transparent={true} visible={isVisible}>
            <View style={{backgroundColor: "#000000aa", flex: 1}}>
                <View style={styles.contentContainer}>
                    <TextInput
                        ref={textInputRef}
                        placeholder={"Type here..."}
                        placeholderTextColor={"grey"}
                        onChangeText={setCurrentCategoryName}
                        style={styles.textInput}
                    >
                        {currentCategoryName}
                    </TextInput>
                    <View style={styles.colorPickerView}>
                        <Text 
                            style={{
                                backgroundColor: currentColor, 
                                borderWidth: .5,
                                borderColor: currentColor.toLowerCase() == "#ffffff" ? "black" : "white",
                                width: 40,
                                height: 40
                            }}
                        >
                            {""}
                        </Text>
                        <Button 
                            title="Select color"
                            onPress={() => setColorModalProps({
                                sendColor: (id, color) => setCurrentColor(color), 
                                sendVisibility: setColorModalVisibility, 
                                visible: true,
                                id: null,
                                initialColor: currentColor
                            })
                            }
                        />
                        <ColorPickerModal 
                            props={colorModalProps}
                        />
                    </View>
                    <View style={{marginHorizontal: "25%", marginVertical: "10%", flexDirection: "row", justifyContent: "space-between"}}>
                        <Button 
                            title={"Cancel"}
                            onPress={() => {setVisibility(false); props.sendVisibility(false)}}
                        />
                        <Button title="Done" onPress={() => {
                            props.sendData(currentCategoryName, currentColor)
                            setVisibility(false)
                            props.sendVisibility(false)

                            if (!props.noExistingCats){
                                textInputRef.current.clear()
                                setCurrentColor("#ffffff")
                            }
                        }} />
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    contentContainer: {
        backgroundColor: "white", 
        marginHorizontal: "10%",
        height: "30%",
        marginTop: "70%",
        borderWidth: .5,
        borderRadius: 15
    },
    colorPickerView: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: "4%",
        marginTop: "10%",
        marginHorizontal: "18%"
    },
    textInput: {
        marginLeft: "10%",
        marginTop: "15%",
        fontSize: 17
    }
})

export default CreateCategoryModal