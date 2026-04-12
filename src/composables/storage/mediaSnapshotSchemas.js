import { isLikelyMediaString, resolveContextEntityId } from './mediaSnapshotHelpers'

const ROOT_MEDIA_SCHEMA = {
  fields: [
    {
      valueKey: 'wallpaper',
      refKey: 'wallpaperRef',
      scope: 'wallpaper',
      ownerId: () => 'settings',
      itemId: () => 'wallpaper',
      clearRefWhenValueMissing: true
    },
    {
      valueKey: 'lockScreenWallpaper',
      refKey: 'lockScreenWallpaperRef',
      scope: 'wallpaper',
      ownerId: () => 'settings',
      itemId: () => 'lock-screen',
      clearRefWhenValueMissing: true
    }
  ]
}

const CONTACT_SCHEMA = {
  fields: [
    {
      valueKey: 'avatar',
      refKey: 'avatarRef',
      scope: 'contact_avatar',
      ownerId: (contact, index) => contact.id || index,
      itemId: () => 'avatar',
      clearRefWhenValueMissing: true,
      shouldHandle: item => item.avatarType === 'image'
    },
    {
      valueKey: 'chatBackground',
      refKey: 'chatBackgroundRef',
      scope: 'contact_bg',
      ownerId: (contact, index) => contact.id || index,
      itemId: () => 'background',
      clearRefWhenValueMissing: true
    }
  ],
  children: [
    {
      key: 'members',
      collection: true,
      defaultToEmpty: false,
      schema: {
        fields: [
          {
            valueKey: 'avatar',
            refKey: 'avatarRef',
            scope: 'member_avatar',
            ownerId: (_member, _index, ctx) => ctx.parent?.id || ctx.parentIndex,
            itemId: (member, index) => member.id || index,
            clearRefWhenValueMissing: true,
            shouldHandle: item => item.avatarType === 'image'
          }
        ]
      }
    },
    {
      key: 'msgs',
      collection: true,
      defaultToEmpty: true,
      schema: {
        fields: [
          {
            valueKey: 'imageUrl',
            refKey: 'imageRef',
            scope: 'msg',
            ownerId: (_msg, _index, ctx) => ctx.parent?.id || ctx.parentIndex,
            itemId: (msg, index) => msg.id || index,
            shouldHandle: item => !!item.isImage
          }
        ]
      }
    }
  ]
}

const ALBUM_PHOTO_SCHEMA = {
  fields: [
    {
      valueKey: 'url',
      refKey: 'imageRef',
      scope: 'album',
      ownerId: photo => photo.contactId || 'global',
      itemId: (photo, index) => photo.id || index
    },
    {
      valueKey: 'contactAvatar',
      refKey: 'contactAvatarRef',
      scope: 'album_contact_avatar',
      ownerId: photo => photo.contactId || 'global',
      itemId: (photo, index) => `avatar_${photo.id || index}`
    }
  ]
}

const PERSONA_SCHEMA = {
  fields: [
    {
      valueKey: 'avatar',
      refKey: 'avatarRef',
      scope: 'persona_avatar',
      ownerId: (persona, index) => persona.id || index,
      itemId: () => 'avatar',
      clearRefWhenValueMissing: true,
      shouldHandle: item => item.avatarType === 'image'
    }
  ]
}

const STICKER_SCHEMA = {
  fields: [
    {
      valueKey: 'url',
      refKey: 'imageRef',
      scope: 'sticker',
      ownerId: (sticker, index) => sticker.id || index,
      itemId: () => 'image'
    }
  ]
}

const WIDGET_SCHEMA = {
  children: [
    {
      key: 'config',
      collection: false,
      schema: {
        fields: [
          {
            valueKey: 'src',
            refKey: 'srcRef',
            scope: 'widget_image',
            ownerId: (_config, _index, ctx) => ctx.parent?.id || ctx.parentIndex,
            itemId: () => 'image',
            clearRefWhenValueMissing: true,
            extractShouldHandle: (_config, _value, ctx) => ctx.parent?.type === 'image',
            hydrateShouldHandle: null
          }
        ]
      }
    }
  ]
}

const READER_BOOK_SCHEMA = {
  fields: [
    {
      valueKey: 'cover',
      refKey: 'coverRef',
      scope: 'reader_cover',
      ownerId: (book, index) => book.id || index,
      itemId: () => 'cover',
      clearRefWhenValueMissing: true
    }
  ]
}

const FORUM_USER_SCHEMA = {
  fields: [
    {
      valueKey: 'avatar',
      refKey: 'avatarRef',
      scope: 'forum_user_avatar',
      ownerId: user => user.id || 'user',
      itemId: () => 'avatar',
      clearRefWhenValueMissing: true,
      shouldHandle: (item, rawValue) => isLikelyMediaString(rawValue) || !!item.avatarRef
    }
  ]
}

const FORUM_SCHEMA = {
  fields: [
    {
      valueKey: 'authorAvatar',
      refKey: 'authorAvatarRef',
      scope: 'forum_author_avatar',
      ownerId: (moment, index) => moment.id || index,
      itemId: () => 'author',
      clearRefWhenValueMissing: true,
      shouldHandle: (item, rawValue) => isLikelyMediaString(rawValue) || !!item.authorAvatarRef
    }
  ],
  listFields: [
    {
      valueKey: 'images',
      refsKey: 'imageRefs',
      scope: 'forum_image',
      ownerId: (moment, index) => moment.id || index,
      itemId: (_value, imageIndex) => imageIndex,
      clearRefsWhenValueMissing: true
    }
  ],
  children: [
    {
      key: 'replies',
      collection: true,
      defaultToEmpty: true,
      schema: {
        fields: [
          {
            valueKey: 'authorAvatar',
            refKey: 'authorAvatarRef',
            scope: 'forum_reply_avatar',
            ownerId: (_reply, _index, ctx) => ctx.parent?.id || ctx.parentIndex,
            itemId: (reply, index) => reply.id || index,
            clearRefWhenValueMissing: true,
            shouldHandle: (item, rawValue) => isLikelyMediaString(rawValue) || !!item.authorAvatarRef
          }
        ]
      }
    }
  ]
}

const SAVED_THEME_SCHEMA = {
  children: [
    {
      key: 'data',
      collection: false,
      schema: {
        fields: [
          {
            valueKey: 'mockImagePlaceholder',
            refKey: 'mockImagePlaceholderRef',
            scope: 'saved_theme_mock_placeholder',
            ownerId: (_data, _index, ctx) => ctx.parent?.id || ctx.parentIndex,
            itemId: () => 'mock-image-placeholder',
            clearRefWhenValueMissing: true
          }
        ]
      }
    }
  ]
}

const PLANNER_SCHEMA = {
  children: [
    {
      key: 'diaryEntries',
      collection: true,
      defaultToEmpty: true,
      schema: {
        listFields: [
          {
            valueKey: 'images',
            refsKey: 'imageRefs',
            scope: 'planner_diary_image',
            ownerId: (entry, index) => entry.id || index,
            itemId: (_value, imageIndex) => imageIndex,
            clearRefsWhenValueMissing: true
          }
        ]
      }
    }
  ]
}

const CALL_RESOURCE_SCHEMA = {
  fields: [
    {
      valueKey: 'avatar',
      refKey: 'avatarRef',
      scope: 'call_avatar',
      ownerId: (_resource, _index, ctx) => resolveContextEntityId(ctx, 'call'),
      itemId: () => 'avatar',
      clearRefWhenValueMissing: true,
      shouldHandle: (item, rawValue) => isLikelyMediaString(rawValue) || !!item.avatarRef
    },
    {
      valueKey: 'characterImage',
      refKey: 'characterImageRef',
      scope: 'call_character_image',
      ownerId: (_resource, _index, ctx) => resolveContextEntityId(ctx, 'call'),
      itemId: () => 'character-image',
      clearRefWhenValueMissing: true,
      shouldHandle: (item, rawValue) => isLikelyMediaString(rawValue) || !!item.characterImageRef
    }
  ],
  listFields: [
    {
      valueKey: 'backgrounds',
      refsKey: 'backgroundRefs',
      scope: 'call_background',
      ownerId: (_resource, _index, ctx) => resolveContextEntityId(ctx, 'call'),
      itemId: (_value, imageIndex) => imageIndex,
      clearRefsWhenValueMissing: true
    }
  ],
  recordFields: [
    {
      valueKey: 'sprites',
      refsKey: 'spriteRefs',
      scope: 'call_sprite',
      ownerId: (_value, _key, ctx) => resolveContextEntityId(ctx, 'call'),
      itemId: (_value, key) => key,
      clearRefsWhenValueMissing: true
    }
  ]
}

const CHARACTER_RESOURCE_SCHEMA = {
  children: [
    {
      key: 'baseImage',
      collection: false,
      schema: {
        fields: [
          {
            valueKey: 'url',
            refKey: 'urlRef',
            scope: 'character_base',
            ownerId: (_image, _index, ctx) => resolveContextEntityId(ctx, 'character'),
            itemId: () => 'base',
            clearRefWhenValueMissing: true
          }
        ]
      }
    },
    {
      key: 'expressions',
      record: true,
      defaultToEmpty: false,
      schema: {
        fields: [
          {
            valueKey: 'url',
            refKey: 'urlRef',
            scope: 'character_expression',
            ownerId: (_image, _index, ctx) => resolveContextEntityId(ctx, 'character'),
            itemId: (_image, _index, ctx) => ctx.key || ctx.index,
            clearRefWhenValueMissing: true
          }
        ]
      }
    },
    {
      key: 'generationPrefs',
      collection: false,
      schema: {
        fields: [
          {
            valueKey: 'characterRefImage',
            refKey: 'characterRefImageRef',
            scope: 'character_ref',
            ownerId: (_prefs, _index, ctx) => resolveContextEntityId(ctx, 'character'),
            itemId: () => 'character-reference',
            clearRefWhenValueMissing: true
          }
        ],
        children: [
          {
            key: 'vibeReferences',
            collection: true,
            defaultToEmpty: true,
            schema: {
              fields: [
                {
                  valueKey: 'image',
                  refKey: 'imageRef',
                  scope: 'character_vibe',
                  ownerId: (_item, _index, ctx) => resolveContextEntityId(ctx, 'character'),
                  itemId: (item, index) => item.id || index,
                  clearRefWhenValueMissing: true
                }
              ]
            }
          }
        ]
      }
    }
  ]
}

const VN_PROJECT_SAVE_SCHEMA = {
  children: [
    {
      key: 'snapshot',
      collection: false,
      schema: {
        children: [
          {
            key: 'playerSnapshot',
            collection: false,
            schema: {
              children: [
                {
                  key: 'currentBg',
                  collection: false,
                  schema: {
                    fields: [
                      {
                        valueKey: 'url',
                        refKey: 'urlRef',
                        scope: 'vn_save_background',
                        ownerId: (_bg, _index, ctx) => resolveContextEntityId(ctx, 'vn-save'),
                        itemId: () => 'current-background',
                        clearRefWhenValueMissing: true
                      }
                    ]
                  }
                },
                {
                  key: 'sprites',
                  collection: true,
                  defaultToEmpty: true,
                  schema: {
                    fields: [
                      {
                        valueKey: 'url',
                        refKey: 'urlRef',
                        scope: 'vn_save_sprite',
                        ownerId: (_sprite, _index, ctx) => resolveContextEntityId(ctx, 'vn-save'),
                        itemId: (sprite, index) => sprite.id || `${sprite.characterId || 'sprite'}_${sprite.expression || index}`,
                        clearRefWhenValueMissing: true
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
}

const VN_PROJECT_SCHEMA = {
  children: [
    {
      key: 'resources',
      collection: false,
      schema: {
        children: [
          {
            key: 'backgrounds',
            record: true,
            defaultToEmpty: false,
            schema: {
              fields: [
                {
                  valueKey: 'url',
                  refKey: 'urlRef',
                  scope: 'vn_background',
                  ownerId: (_resource, _index, ctx) => resolveContextEntityId(ctx, 'vn'),
                  itemId: (_resource, _index, ctx) => ctx.key || ctx.index,
                  clearRefWhenValueMissing: true
                }
              ]
            }
          },
          {
            key: 'sprites',
            record: true,
            defaultToEmpty: false,
            schema: {
              fields: [
                {
                  valueKey: 'url',
                  refKey: 'urlRef',
                  scope: 'vn_sprite',
                  ownerId: (_resource, _index, ctx) => resolveContextEntityId(ctx, 'vn'),
                  itemId: (_resource, _index, ctx) => ctx.key || ctx.index,
                  clearRefWhenValueMissing: true
                }
              ]
            }
          }
        ]
      }
    },
    {
      key: 'saves',
      collection: true,
      defaultToEmpty: true,
      schema: VN_PROJECT_SAVE_SCHEMA
    }
  ]
}

const MEET_MEETING_SAVE_SCHEMA = {
  children: [
    {
      key: 'snapshot',
      collection: false,
      schema: {
        children: [
          {
            key: 'playerSnapshot',
            collection: false,
            schema: {
              children: [
                {
                  key: 'currentBg',
                  collection: false,
                  schema: {
                    fields: [
                      {
                        valueKey: 'url',
                        refKey: 'urlRef',
                        scope: 'meet_save_background',
                        ownerId: (_bg, _index, ctx) => resolveContextEntityId(ctx, 'meet-save'),
                        itemId: () => 'current-background',
                        clearRefWhenValueMissing: true
                      }
                    ]
                  }
                },
                {
                  key: 'currentCg',
                  collection: false,
                  schema: {
                    fields: [
                      {
                        valueKey: 'url',
                        refKey: 'urlRef',
                        scope: 'meet_save_cg',
                        ownerId: (_cg, _index, ctx) => resolveContextEntityId(ctx, 'meet-save'),
                        itemId: () => 'current-cg',
                        clearRefWhenValueMissing: true
                      }
                    ]
                  }
                },
                {
                  key: 'sprites',
                  collection: true,
                  defaultToEmpty: true,
                  schema: {
                    fields: [
                      {
                        valueKey: 'url',
                        refKey: 'urlRef',
                        scope: 'meet_save_sprite',
                        ownerId: (_sprite, _index, ctx) => resolveContextEntityId(ctx, 'meet-save'),
                        itemId: (sprite, index) => sprite.id || `${sprite.characterId || 'sprite'}_${sprite.expression || index}`,
                        clearRefWhenValueMissing: true
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
}

const MEET_MEETING_SCHEMA = {
  children: [
    {
      key: 'resources',
      collection: false,
      schema: {
        children: [
          {
            key: 'backgrounds',
            record: true,
            defaultToEmpty: false,
            schema: {
              fields: [
                {
                  valueKey: 'url',
                  refKey: 'urlRef',
                  scope: 'meet_background',
                  ownerId: (_resource, _index, ctx) => resolveContextEntityId(ctx, 'meet'),
                  itemId: (_resource, _index, ctx) => ctx.key || ctx.index,
                  clearRefWhenValueMissing: true
                }
              ]
            }
          },
          {
            key: 'cgs',
            record: true,
            defaultToEmpty: false,
            schema: {
              fields: [
                {
                  valueKey: 'url',
                  refKey: 'urlRef',
                  scope: 'meet_cg',
                  ownerId: (_resource, _index, ctx) => resolveContextEntityId(ctx, 'meet'),
                  itemId: (_resource, _index, ctx) => ctx.key || ctx.index,
                  clearRefWhenValueMissing: true
                }
              ]
            }
          },
          {
            key: 'sprites',
            record: true,
            defaultToEmpty: false,
            schema: {
              fields: [
                {
                  valueKey: 'url',
                  refKey: 'urlRef',
                  scope: 'meet_sprite',
                  ownerId: (_resource, _index, ctx) => resolveContextEntityId(ctx, 'meet'),
                  itemId: (_resource, _index, ctx) => ctx.key || ctx.index,
                  clearRefWhenValueMissing: true
                }
              ]
            }
          }
        ]
      }
    },
    {
      key: 'saves',
      collection: true,
      defaultToEmpty: true,
      schema: MEET_MEETING_SAVE_SCHEMA
    }
  ]
}

const SNAPSHOT_OBJECT_SCHEMAS = [
  { key: 'forumUser', schema: FORUM_USER_SCHEMA },
  { key: 'planner', schema: PLANNER_SCHEMA }
]

const SNAPSHOT_RECORD_SCHEMAS = [
  { key: 'callResources', schema: CALL_RESOURCE_SCHEMA },
  { key: 'characterResources', schema: CHARACTER_RESOURCE_SCHEMA }
]

const SNAPSHOT_COLLECTION_SCHEMAS = [
  { key: 'contacts', schema: CONTACT_SCHEMA },
  { key: 'albumPhotos', schema: ALBUM_PHOTO_SCHEMA },
  { key: 'personas', schema: PERSONA_SCHEMA },
  { key: 'stickers', schema: STICKER_SCHEMA },
  { key: 'widgets', schema: WIDGET_SCHEMA },
  { key: 'readerBooks', schema: READER_BOOK_SCHEMA },
  { key: 'forum', schema: FORUM_SCHEMA },
  { key: 'savedThemes', schema: SAVED_THEME_SCHEMA },
  { key: 'vnProjects', schema: VN_PROJECT_SCHEMA },
  { key: 'meetMeetings', schema: MEET_MEETING_SCHEMA }
]

const THEME_SCHEMA = {
  fields: [
    {
      valueKey: 'mockImagePlaceholder',
      refKey: 'mockImagePlaceholderRef',
      scope: 'theme_mock_placeholder',
      ownerId: () => 'theme',
      itemId: () => 'mock-image-placeholder',
      clearRefWhenValueMissing: true
    }
  ],
  recordFields: [
    {
      valueKey: 'appIcons',
      refsKey: 'appIconRefs',
      scope: 'theme_icon',
      ownerId: () => 'theme',
      itemId: (_value, key) => key,
      clearRefsWhenValueMissing: true
    }
  ]
}


export {
  ROOT_MEDIA_SCHEMA,
  SNAPSHOT_OBJECT_SCHEMAS,
  SNAPSHOT_RECORD_SCHEMAS,
  SNAPSHOT_COLLECTION_SCHEMAS,
  THEME_SCHEMA
}
