let tags = UiSelector().clickable(true).find();
let count = 0;
for (let i in tags) {
    if (++count > 3) {
        break;
    }
    console.log(tags[i]);
}


for (let i = 0; i < 10; i++) {
    console.log(i);
}