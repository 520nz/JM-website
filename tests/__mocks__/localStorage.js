/**
 * 独立的localStorage mock
 * 使用工厂函数确保每个测试文件有独立的实例
 */

// 工厂函数：每次调用创建新的localStorage实例
function createLocalStorage() {
    let store = {};

    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => {
            // 清空对象的所有属性，而不是重新赋值
            for (const key in store) {
                delete store[key];
            }
        },
        getStore: () => store  // 用于调试
    };
}

// 每次require都创建新实例
module.exports = createLocalStorage();