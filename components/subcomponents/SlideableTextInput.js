import React, {useState} from 'react'
import {View, Text, TextInput} from 'react-native'

/*
    Problem: TextInput will never pass touches to its parent component therefore you cannot slide a TextInput
    Solution: Switch Text with TextInput and autoFocus onPress
    Lesson: Once again, quick and dirty first then optimize as needed lmao

    This component and its styles are constrained since we only need this component for the categories screen

    LFG ... first run-in with the downsides of react native but litrally lost nothing
*/

const SlideableTextInput = ({ categoryID, categoryName, sendNewCategoryName }) => {
    const [isTextInput, setIsTextInput] = useState(false)

    const getTextComponent = () => {
        if (isTextInput){
            return (
                <TextInput style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    paddingTop: "1%",
                    paddingBottom: 0
                    }}
                    autoFocus={true}
                    placeholder={"Type here..."}
                    onEndEditing={event => {
                        setIsTextInput(false)

                        // if the typed in value is diff than the old one
                        if (event.nativeEvent.text != categoryName){
                            sendNewCategoryName(
                                categoryID,
                                event.nativeEvent.text
                            )
                        }
                    }}
                >
                    {categoryName}
                </TextInput>
            )
        }
        else{
            return (
                <Text 
                    style={{
                        fontSize: 20,
                        fontWeight: "bold",
                        paddingTop: "1%",
                        marginLeft: 4,
                        paddingRight: 50,
                        color: categoryName == "" ? "#999999" : "black"
                        }}
                    onPress={() => setIsTextInput(true)}
                >
                    {categoryName == "" ? "Type here..." : categoryName}
                </Text>
            )
        }  
    }

    return (
        <View>
            {getTextComponent()}
        </View>
    )
}

export default SlideableTextInput
