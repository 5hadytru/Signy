import React, {useState, useEffect} from 'react'
import ColorPicker from 'react-native-wheel-color-picker'
import {Modal, View, Button, StyleSheet} from 'react-native'

const ColorPickerModal = ({ props }) => {

    // initialize visibility to modalProps.visible onMount and watch it for changes (when the user closes this modal)
    const [isVisible, setVisibility] = useState(() => false)
    useEffect(() => {
        setVisibility(props.visible)
    }, [props])

    const [currentColor, setCurrentColor] = useState(props.initialColor)
    const sendColorData = () => {
        props.sendColor(props.id, currentColor);
    }

    return (
        <Modal transparent={true} visible={isVisible}>
            <View style={{backgroundColor: "#000000aa", flex: 1}}>
                <View style={styles.contentContainer}>
                    <ColorPicker 
                        onColorChange={setCurrentColor}
                        color={currentColor}
                        sliderSize={20}
                        style={{marginHorizontal: "10%"}}
                    />
                    <View style={{marginHorizontal: "25%", marginVertical: "10%"}}>
                        <Button title="Done" onPress={() => {
                            sendColorData()
                            setVisibility(false)
                            props.sendVisibility(false)
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
        height: "60%",
        marginTop: "30%",
        borderWidth: .5,
        borderRadius: 15
    }
})

export default ColorPickerModal
